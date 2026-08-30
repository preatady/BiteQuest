import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Place, QuickRatingTaste, QuickRatingPrice } from '../types';
import { auth } from '../firebase';
import { useLanguage } from '../context/LanguageContext';
import {
  Camera,
  RotateCw,
  Zap,
  ZapOff,
  Image as ImageIcon,
  X,
  ArrowLeft,
  Sparkles,
  Tag,
  CheckCircle2,
  AlertCircle,
  MapPin,
  RefreshCw,
  Flame,
  Coffee,
  Soup,
  Award,
  Smile,
  Send,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Ratio,
} from 'lucide-react';
import {
  CAMERA_FILTERS,
  FilterId,
  ASPECT_RATIOS,
  AspectRatioId,
  getStickersList,
} from './cameraFilters';

interface CameraBiteViewProps {
  preselectedPlace?: Place | null;
  onClose?: () => void;
  onCheckinSuccess: (checkinData: any) => void;
  onOpenCommunitySpotModal: (prefillData: any) => void;
}

export const CameraBiteView: React.FC<CameraBiteViewProps> = ({
  preselectedPlace,
  onClose,
  onCheckinSuccess,
  onOpenCommunitySpotModal,
}) => {
  const { t, isVi } = useLanguage();

  // 1. Permission and Camera lifecycle
  const [cameraPermission, setCameraPermission] = useState<
    'requesting' | 'ready' | 'denied' | 'unavailable' | 'error'
  >('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isFlashOn, setIsFlashOn] = useState<boolean>(false);
  const [hasFlash, setHasFlash] = useState<boolean>(false);

  // Aspect ratio state (1:1 Vuông Locket, 3:4 Chuẩn máy ảnh, 9:16 Toàn màn hình, 4:3 Ngang)
  const [aspectRatioId, setAspectRatioId] = useState<AspectRatioId>(() => {
    try {
      const saved = localStorage.getItem('bitequest_camera_aspect') as AspectRatioId;
      if (saved && ['1:1', '3:4', '9:16', '4:3'].includes(saved)) {
        return saved;
      }
    } catch {}
    return '1:1'; // Default to 1:1 square for authentic Locket food vibes
  });
  const [showRatioPicker, setShowRatioPicker] = useState<boolean>(false);

  // 2. Capture flow and media state - default to 'locket_skin' for flattering natural skin tone
  const [captureStep, setCaptureStep] = useState<'live' | 'review'>('live');
  const [originalEvidence, setOriginalEvidence] = useState<string | null>(null);
  const [isGalleryUpload, setIsGalleryUpload] = useState<boolean>(false);
  const [selectedFilterId, setSelectedFilterId] = useState<FilterId>('locket_skin');
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>('location');

  // Review tools
  const [activePickerTab, setActivePickerTab] = useState<'none' | 'filter' | 'sticker' | 'place'>('none');
  const [showAdvancedReview, setShowAdvancedReview] = useState<boolean>(false);

  // 3. Verification & Metadata
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [selectedPlaceCandidate, setSelectedPlaceCandidate] = useState<Place | null>(
    preselectedPlace || null
  );
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Metadata: Dish, Tags, Caption
  const [autoAiDetect, setAutoAiDetect] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bitequest_auto_ai');
      return saved !== 'false';
    } catch {
      return true;
    }
  });
  const [dishName, setDishName] = useState<string>('');
  const [tags, setTags] = useState<string[]>(['#ngon', '#chill']);
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [caption, setCaption] = useState<string>('');

  // Optional ratings (can be submitted or omitted)
  const [tasteRating, setTasteRating] = useState<QuickRatingTaste | null>(null);
  const [priceRating, setPriceRating] = useState<QuickRatingPrice | null>(null);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);

  // 4. GPS State in parallel
  const [gpsStatus, setGpsStatus] = useState<'locating' | 'ready' | 'denied' | 'unavailable'>('locating');
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    district: string;
  }>({
    lat: 21.0185,
    lng: 105.7952,
    accuracy: 15,
    district: 'Cầu Giấy',
  });

  const activeStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper: Stop stream
  const stopActiveStream = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
      activeStreamRef.current = null;
    }
  }, []);

  // Attach stream to video
  const attachStreamToVideo = useCallback((stream: MediaStream, video: HTMLVideoElement) => {
    try {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('muted', 'true');

      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }

      const tryPlay = () => {
        if (video && typeof video.play === 'function') {
          video.play().catch(() => {});
        }
      };
      tryPlay();
      video.onloadedmetadata = tryPlay;
      video.oncanplay = tryPlay;
      video.onloadeddata = tryPlay;
    } catch (err) {
      console.warn('Error attaching stream:', err);
    }
  }, []);

  // Request & Start camera stream
  const startCamera = useCallback(
    async (targetFacing: 'environment' | 'user' = 'environment') => {
      stopActiveStream();
      setCameraPermission('requesting');
      setErrorMessage(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermission('unavailable');
        setErrorMessage(
          isVi
            ? 'Trình duyệt không hỗ trợ truy cập camera. Bạn có thể chọn ảnh từ máy.'
            : 'Camera API not supported in this browser. You can upload from gallery.'
        );
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (primaryErr) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (fallbackErr: any) {
          if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
            setCameraPermission('denied');
          } else {
            setCameraPermission('error');
          }
          setErrorMessage(fallbackErr.message || 'Không thể mở camera.');
          return;
        }
      }

      if (stream) {
        activeStreamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities() as any;
          setHasFlash(Boolean(caps?.torch));
        } else {
          setHasFlash(false);
        }

        setFacingMode(targetFacing);
        setCameraPermission('ready');
        if (videoRef.current) {
          attachStreamToVideo(stream, videoRef.current);
        }
      }
    },
    [stopActiveStream, attachStreamToVideo, isVi]
  );

  // Initialize camera & GPS
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopActiveStream();
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 15,
          district: 'Cầu Giấy',
        });
        setGpsStatus('ready');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
        } else {
          setGpsStatus('unavailable');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 6000 }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  const handleToggleFlash = async () => {
    if (!activeStreamRef.current || !hasFlash) return;
    const track = activeStreamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !isFlashOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsFlashOn(nextState);
      } catch (e) {
        console.warn('Torch toggle error:', e);
      }
    }
  };

  const compressImage = (dataUrl: string, maxDim = 1400, quality = 0.88): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const toggleAutoAi = (forceValue?: boolean) => {
    const nextVal = forceValue !== undefined ? forceValue : !autoAiDetect;
    setAutoAiDetect(nextVal);
    try {
      localStorage.setItem('bitequest_auto_ai', String(nextVal));
    } catch {}
    if (captureStep === 'review' && originalEvidence) {
      triggerVerification(originalEvidence, isGalleryUpload, selectedPlaceCandidate?.id, nextVal);
    }
  };

  const handleAddTag = (tagToAdd: string) => {
    let cleaned = tagToAdd.trim();
    if (!cleaned) return;
    if (!cleaned.startsWith('#')) {
      cleaned = '#' + cleaned.replace(/\s+/g, '_');
    }
    if (!tags.includes(cleaned)) {
      setTags((prev) => [...prev, cleaned]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Background verification
  const triggerVerification = async (
    rawImage: string,
    isGallery: boolean,
    candidatePlaceId?: string,
    overrideAutoAi?: boolean
  ) => {
    setIsVerifying(true);
    setVerificationResult(null);

    const useAutoAi = overrideAutoAi !== undefined ? overrideAutoAi : autoAiDetect;

    try {
      const targetPlaceId = candidatePlaceId || preselectedPlace?.id || selectedPlaceCandidate?.id;
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/verify-bite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageBase64: rawImage.startsWith('data:') ? rawImage : undefined,
          latitude: userCoords.lat,
          longitude: userCoords.lng,
          accuracy: userCoords.accuracy,
          selectedPlaceId: targetPlaceId,
          isGalleryUpload: isGallery,
          autoAiDetect: useAutoAi,
          skipAiRecognition: !useAutoAi,
          customDishName: dishName || undefined,
          customTags: tags.length > 0 ? tags : undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setVerificationResult(result);
        if (result.matchedPlace) {
          setSelectedPlaceCandidate(result.matchedPlace);
        }
        if (result.aiAnalysis?.dishName && !dishName) {
          setDishName(result.aiAnalysis.dishName);
        }
        if (result.aiAnalysis?.tags && result.aiAnalysis.tags.length > 0 && tags.length <= 1) {
          setTags(result.aiAnalysis.tags);
        }
      }
    } catch (err) {
      console.warn('Verification fallback:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Snappy Locket-Style Shutter Capture with Aspect Ratio Cropping
  const handleShutterCapture = () => {
    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(30);
      } catch (e) {}
    }

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const vWidth = video.videoWidth || 1280;
      const vHeight = video.videoHeight || 720;
      const targetRatio = currentRatioOption.ratio; // W / H
      const videoRatio = vWidth / vHeight;

      let cropW = vWidth;
      let cropH = vHeight;
      let cropX = 0;
      let cropY = 0;

      if (videoRatio > targetRatio) {
        // Video is wider than target frame -> crop left/right to center
        cropH = vHeight;
        cropW = Math.max(1, Math.round(vHeight * targetRatio));
        cropX = Math.max(0, Math.round((vWidth - cropW) / 2));
        cropY = 0;
      } else {
        // Video is taller than target frame -> crop top/bottom to center
        cropW = vWidth;
        cropH = Math.max(1, Math.round(vWidth / targetRatio));
        cropX = 0;
        cropY = Math.max(0, Math.round((vHeight - cropH) / 2));
      }

      canvas.width = cropW;
      canvas.height = cropH;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(cropW, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const rawDataUrl = canvas.toDataURL('image/jpeg', 0.90);

        setOriginalEvidence(rawDataUrl);
        setIsGalleryUpload(false);
        setCaptureStep('review');
        stopActiveStream();

        triggerVerification(rawDataUrl, false);
      }
    }
  };

  // Gallery Upload
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await compressImage(reader.result, 1400, 0.88);
          setOriginalEvidence(compressed);
          setIsGalleryUpload(true);
          setCaptureStep('review');
          stopActiveStream();
          triggerVerification(compressed, true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRetake = () => {
    setOriginalEvidence(null);
    setVerificationResult(null);
    setActivePickerTab('none');
    setCaptureStep('live');
    startCamera(facingMode);
  };

  // Instant 1-Tap Submit Bite
  const handleSubmitBite = async () => {
    if (isSubmittingReview) return;
    setIsSubmittingReview(true);

    try {
      const place = selectedPlaceCandidate || verificationResult?.matchedPlace || preselectedPlace || {
        id: 'place_bun_ca_co_lan',
        name: 'Bún Cá Cô Lan',
        address: '116 Vũ Phạm Hàm, Cầu Giấy',
        district: userCoords.district || 'Cầu Giấy',
      };
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          verificationSessionId: verificationResult?.verificationSessionId,
          placeId: place.id,
          providerPlaceId: (place as any)?.providerPlaceId,
          placeName: place.name,
          district: place.district || userCoords.district,
          foodCategory: verificationResult?.aiAnalysis?.foodCategory || 'noodles',
          imageUrl: originalEvidence || 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
          displayImageUrl: originalEvidence,
          filterId: selectedFilterId,
          stickerId: selectedStickerId || undefined,
          isGalleryUpload,
          autoAiDetect,
          dishName: dishName.trim() || verificationResult?.aiAnalysis?.dishName || undefined,
          tags: tags && tags.length > 0 ? tags : undefined,
          caption: caption.trim() ? caption.trim() : undefined,
          tasteRating: tasteRating || undefined,
          priceRating: priceRating || undefined,
          wouldReturn: wouldReturn !== null ? wouldReturn : undefined,
          isNewSpot: verificationResult?.isNewCommunitySpot || false,
        }),
      });

      const data = await response.json();
      onCheckinSuccess(data);
    } catch (err) {
      console.error('Bite submit error:', err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const currentRatioOption =
    ASPECT_RATIOS.find((r) => r.id === aspectRatioId) || ASPECT_RATIOS[0];
  const currentFilter = CAMERA_FILTERS.find((f) => f.id === selectedFilterId) || CAMERA_FILTERS[0];
  const stickers = getStickersList(
    selectedPlaceCandidate?.name || verificationResult?.matchedPlace?.name || preselectedPlace?.name,
    userCoords.district,
    isGalleryUpload
  );
  const activeSticker = stickers.find((s) => s.id === selectedStickerId);

  // Helper for viewfinder aspect ratio classes
  const getAspectRatioClasses = (ratioId: AspectRatioId) => {
    switch (ratioId) {
      case '1:1':
        return 'w-full max-w-[min(90vw,420px)] aspect-square rounded-3xl border-2 border-white/25 shadow-2xl';
      case '3:4':
        return 'w-full max-w-[min(90vw,440px)] aspect-[3/4] rounded-3xl border-2 border-white/25 shadow-2xl';
      case '4:3':
        return 'w-full max-w-[min(96vw,520px)] aspect-[4/3] rounded-3xl border-2 border-white/25 shadow-2xl';
      case '9:16':
      default:
        return 'w-full h-full max-w-full max-h-full rounded-none';
    }
  };

  // Render Sticker Icon helper
  const renderStickerIcon = (iconName: string) => {
    switch (iconName) {
      case 'MapPin': return <MapPin className="w-3.5 h-3.5" />;
      case 'CheckCircle2': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'Image': return <ImageIcon className="w-3.5 h-3.5" />;
      case 'Soup': return <Soup className="w-3.5 h-3.5" />;
      case 'Coffee': return <Coffee className="w-3.5 h-3.5" />;
      case 'Flame': return <Flame className="w-3.5 h-3.5" />;
      case 'Award': return <Award className="w-3.5 h-3.5" />;
      default: return <Smile className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#100F0E] text-white flex flex-col justify-between select-none overflow-hidden"
      id="camera-bite-experience"
    >
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryUpload}
        className="hidden"
      />

      {/* ========================================================= */}
      {/* 1. MEDIA VIEWPORT (Live Video OR Captured Freeze Frame)   */}
      {/* ========================================================= */}
      <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center p-0">
        <div
          className={`relative overflow-hidden flex items-center justify-center transition-all duration-300 ${getAspectRatioClasses(
            aspectRatioId
          )}`}
        >
          {captureStep === 'live' ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              disablePictureInPicture
              className="w-full h-full object-cover transition-all duration-200"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: currentFilter.cssFilter, // Locket-style flattering skin tone live preview!
              }}
            />
          ) : (
            <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
              <img
                src={originalEvidence || ''}
                alt="Captured Bite"
                className="w-full h-full object-cover transition-all duration-200"
                style={{ filter: currentFilter.cssFilter }}
              />

              {/* Contextual Floating Sticker on Image */}
              {activeSticker && (
                <div
                  className={`absolute top-4 left-4 px-3.5 py-1.5 rounded-full border text-xs font-bold font-heading flex items-center gap-1.5 shadow-xl animate-fade-in ${activeSticker.badgeStyle}`}
                >
                  {renderStickerIcon(activeSticker.iconName)}
                  <span>{activeSticker.label}</span>
                </div>
              )}
            </div>
          )}

          {/* Subtle Viewfinder Ratio Indicator Badge inside frame */}
          {captureStep === 'live' && aspectRatioId !== '9:16' && (
            <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/20 text-[10px] font-heading font-semibold text-white/80 pointer-events-none">
              {currentRatioOption.label}
            </div>
          )}
        </div>

        {/* Cinematic soft vignette gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none" />
      </div>

      {/* Aspect Ratio Picker Popup */}
      {showRatioPicker && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black/85 backdrop-blur-xl border border-white/25 rounded-2xl p-1.5 flex items-center gap-1.5 shadow-2xl animate-fade-in"
          id="popover-aspect-ratio"
        >
          {ASPECT_RATIOS.map((ratio) => {
            const isSelected = aspectRatioId === ratio.id;
            return (
              <button
                key={ratio.id}
                onClick={() => {
                  setAspectRatioId(ratio.id);
                  setShowRatioPicker(false);
                  try {
                    localStorage.setItem('bitequest_camera_aspect', ratio.id);
                  } catch {}
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold transition-all flex flex-col items-center cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF6B35] text-white shadow-md scale-105'
                    : 'text-white/80 hover:bg-white/15'
                }`}
              >
                <span>{ratio.label}</span>
                <span className="text-[9px] font-normal opacity-80">
                  {isVi ? ratio.subLabelVi : ratio.subLabelEn}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. TOP HUD HEADER BAR                                     */}
      {/* ========================================================= */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 w-full">
        {/* Left: Close or Retake */}
        {captureStep === 'live' ? (
          <button
            onClick={() => {
              stopActiveStream();
              onClose?.();
            }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95 transition-transform"
            title={isVi ? 'Đóng' : 'Close'}
            id="btn-camera-close"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleRetake}
            className="bg-black/50 backdrop-blur-md border border-white/25 text-white px-3.5 py-1.5 rounded-full text-xs font-bold font-heading flex items-center gap-1.5 active:scale-95 transition-transform shadow-md"
            id="btn-retake-bite"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isVi ? 'Chụp lại' : 'Retake'}</span>
          </button>
        )}

        {/* Center: Live GPS & Location chip */}
        <div className="flex items-center gap-1.5">
          <div className="bg-black/50 backdrop-blur-md border border-white/25 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
            <MapPin className="w-3.5 h-3.5 text-[#FF6B35]" />
            <span className="font-heading text-xs font-bold text-white tracking-tight max-w-[110px] truncate">
              {selectedPlaceCandidate?.name || userCoords.district}
            </span>
          </div>

          <button
            onClick={() => toggleAutoAi()}
            className={`px-2.5 py-1.5 rounded-full backdrop-blur-md border text-xs font-bold font-heading flex items-center gap-1 transition-all cursor-pointer ${
              autoAiDetect
                ? 'bg-[#2EC4B6]/90 text-white border-[#2EC4B6]'
                : 'bg-black/60 text-[#FFD166] border-[#FFD166]/50'
            }`}
            title={isVi ? 'Bật/Tắt tự động AI' : 'Toggle AI Auto Detect'}
            id="btn-toggle-auto-ai"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{autoAiDetect ? 'AI: ON' : '✍️'}</span>
          </button>
        </div>

        {/* Right: Aspect Ratio Selector + Flash in Live Mode */}
        {captureStep === 'live' ? (
          <div className="flex items-center gap-1.5">
            {/* Aspect ratio button */}
            <button
              onClick={() => setShowRatioPicker((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-full backdrop-blur-md border flex items-center gap-1 text-xs font-bold font-heading transition-all cursor-pointer ${
                showRatioPicker
                  ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                  : 'bg-black/40 text-white border-white/20 hover:bg-black/60'
              }`}
              title={isVi ? 'Tỷ lệ khung hình' : 'Aspect ratio'}
              id="btn-camera-aspect"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#FFD166]" />
              <span>{currentRatioOption.label}</span>
            </button>

            {/* Flash button */}
            <button
              onClick={handleToggleFlash}
              disabled={!hasFlash}
              className={`w-9 h-9 rounded-full backdrop-blur-md border flex items-center justify-center active:scale-95 transition-all ${
                isFlashOn
                  ? 'bg-[#FFD166] text-[#2D2926] border-[#FFD166]'
                  : hasFlash
                  ? 'bg-black/40 text-white border-white/20'
                  : 'bg-black/20 text-white/30 border-white/10'
              }`}
              title="Flash"
              id="btn-camera-flash"
            >
              {isFlashOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActivePickerTab((prev) => (prev === 'filter' ? 'none' : 'filter'))}
              className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                activePickerTab === 'filter'
                  ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                  : 'bg-black/50 text-white border-white/20'
              }`}
              title="Filter"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActivePickerTab((prev) => (prev === 'sticker' ? 'none' : 'sticker'))}
              className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                activePickerTab === 'sticker'
                  ? 'bg-[#2EC4B6] text-white border-[#2EC4B6]'
                  : 'bg-black/50 text-white border-white/20'
              }`}
              title="Sticker"
            >
              <Tag className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* ========================================================= */}
      {/* 3. CAMERA PERMISSION FALLBACK                             */}
      {/* ========================================================= */}
      {captureStep === 'live' && cameraPermission !== 'ready' && (
        <div className="relative z-30 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
          {cameraPermission === 'requesting' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
              <p className="font-heading text-sm font-semibold text-white/90">
                {isVi ? 'Đang mở camera...' : 'Opening camera...'}
              </p>
            </div>
          ) : (
            <div className="bg-[#2D2926]/90 backdrop-blur-md p-6 rounded-3xl border border-white/15 shadow-2xl flex flex-col items-center gap-4">
              <Camera className="w-10 h-10 text-[#FF6B35]" />
              <div>
                <h3 className="font-heading text-base font-bold text-white mb-1">
                  {isVi ? 'Không mở được camera' : 'Camera unavailable'}
                </h3>
                <p className="text-xs text-white/70">
                  {errorMessage || (isVi ? 'Bạn có thể chọn ảnh từ máy ngay.' : 'You can upload photos from gallery.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[#FF6B35] hover:bg-[#E85D2A] text-white font-heading text-xs font-bold py-3 rounded-full shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                {t('cameraChooseGallery')}
              </button>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="w-full bg-white/15 text-white font-heading text-xs py-2 rounded-full border border-white/20 active:scale-95 cursor-pointer"
              >
                {t('cameraRetryPermission')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. LIVE CAMERA HUD & CONTROLS                             */}
      {/* ========================================================= */}
      {captureStep === 'live' && cameraPermission === 'ready' && (
        <>
          {/* Subtle frame guide */}
          <div className="relative z-10 w-56 h-56 flex items-center justify-center my-auto mx-auto pointer-events-none">
            <div className="w-48 h-48 rounded-3xl border border-white/40 border-dashed flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B35] shadow-[0_0_10px_#FF6B35]" />
            </div>
          </div>

          {/* Bottom Live Controls: Filter Selector + Big Shutter + Gallery + Flip */}
          <div className="relative z-20 flex flex-col items-center gap-3 pb-8 px-5 w-full">
            {/* Live Filter Carousel (Nịnh da default) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 max-w-full px-2">
              {CAMERA_FILTERS.map((f) => {
                const isSelected = selectedFilterId === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilterId(f.id)}
                    className={`px-3 py-1 rounded-full text-xs font-heading font-medium flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-white text-[#2D2926] font-bold shadow-lg scale-105'
                        : 'bg-black/40 text-white/80 border border-white/15 hover:bg-black/60'
                    }`}
                  >
                    <span>{f.emoji}</span>
                    <span>{f.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Shutter row */}
            <div className="flex items-center justify-between w-full max-w-xs pt-1">
              {/* Gallery button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/25 flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg cursor-pointer"
                title={isVi ? 'Chọn ảnh từ máy' : 'Gallery upload'}
                id="btn-gallery-upload"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Shutter Snap */}
              <button
                onClick={handleShutterCapture}
                className="group relative flex items-center justify-center focus:outline-none cursor-pointer"
                id="btn-shutter-capture"
              >
                <div className="w-20 h-20 rounded-full border-4 border-white/90 flex items-center justify-center transition-transform duration-150 active:scale-90 shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-[#FF6B35] shadow-[0_0_20px_rgba(255,107,53,0.8)] group-hover:scale-95 transition-transform" />
                </div>
              </button>

              {/* Flip camera */}
              <button
                onClick={handleFlipCamera}
                className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/25 flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg cursor-pointer"
                title={isVi ? 'Đổi camera' : 'Flip camera'}
                id="btn-flip-camera"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* 5. LOCKET-STYLE REVIEW & INSTANT POST (Snappy & Direct)   */}
      {/* ========================================================= */}
      {captureStep === 'review' && (
        <div className="relative z-20 flex flex-col justify-end h-full pointer-events-auto pb-[max(1rem,env(safe-area-inset-bottom))] px-3 sm:px-4">
          {/* Filter / Sticker Horizontal Drawer when active */}
          {activePickerTab === 'filter' && (
            <div className="mb-3 px-3 py-2 bg-black/75 backdrop-blur-md border border-white/15 rounded-2xl flex items-center justify-start sm:justify-center gap-2 overflow-x-auto no-scrollbar animate-slide-up">
              {CAMERA_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilterId(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-heading font-medium flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer ${
                    selectedFilterId === filter.id
                      ? 'bg-white text-[#2D2926] font-bold shadow-md'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  <span>{filter.emoji}</span>
                  <span>{filter.name}</span>
                </button>
              ))}
            </div>
          )}

          {activePickerTab === 'sticker' && (
            <div className="mb-3 px-3 py-2 bg-black/75 backdrop-blur-md border border-white/15 rounded-2xl flex items-center justify-start sm:justify-center gap-2 overflow-x-auto no-scrollbar animate-slide-up">
              <button
                onClick={() => setSelectedStickerId(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-heading font-medium flex-shrink-0 cursor-pointer ${
                  selectedStickerId === null ? 'bg-[#BA1A1A] text-white font-bold' : 'bg-white/15 text-white'
                }`}
              >
                ✕ {isVi ? 'Không sticker' : 'None'}
              </button>
              {stickers.map((stk) => (
                <button
                  key={stk.id}
                  onClick={() => setSelectedStickerId(stk.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-heading font-medium flex items-center gap-1 flex-shrink-0 transition-all cursor-pointer ${
                    selectedStickerId === stk.id
                      ? 'bg-white text-[#2D2926] font-bold shadow-md'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {renderStickerIcon(stk.iconName)}
                  <span>{stk.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Floating Locket Capsule Control Container */}
          <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-3xl p-3.5 sm:p-4 shadow-2xl flex flex-col gap-2.5 max-w-md w-full mx-auto animate-slide-up text-white">
            {/* Top Quick Bar: Dish name & Tags Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {/* Dish tag chip */}
              <input
                type="text"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                placeholder={isVi ? '🍽️ Tên món (vd: Phở Bò)...' : '🍽️ Dish name...'}
                className="bg-white/15 border border-white/20 text-white rounded-full px-3 py-1 text-xs font-heading font-medium focus:outline-none focus:ring-1 focus:ring-[#FF6B35] min-w-[130px] max-w-[180px] placeholder-white/50"
              />

              {/* Active tags */}
              {tags.map((t, idx) => (
                <span
                  key={idx}
                  className="bg-[#FF6B35]/25 border border-[#FF6B35]/50 text-[#FFD166] text-xs font-heading font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-red-400 cursor-pointer text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              ))}

              {/* Quick Preset Tag Buttons */}
              {(isVi ? ['#ngon', '#re', '#chill', '#viewdep'] : ['#delicious', '#cheap', '#chill', '#scenic']).map(
                (pTag) => {
                  if (tags.includes(pTag)) return null;
                  return (
                    <button
                      key={pTag}
                      type="button"
                      onClick={() => handleAddTag(pTag)}
                      className="bg-white/10 hover:bg-white/20 text-white/80 text-[11px] font-heading font-medium px-2 py-1 rounded-full flex-shrink-0 transition-colors cursor-pointer"
                    >
                      + {pTag}
                    </button>
                  );
                }
              )}
            </div>

            {/* Locket Signature Floating Caption Bar + Quick Emojis + Instant Post Button */}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 focus-within:border-[#FF6B35] transition-all">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitBite();
                  }
                }}
                placeholder={isVi ? 'Ghi cap hoặc tin nhắn...' : 'Add a caption or note...'}
                className="flex-1 bg-transparent text-white text-xs sm:text-sm font-normal focus:outline-none placeholder-white/50"
              />

              {/* Quick Emojis */}
              <div className="flex items-center gap-1">
                {['😋', '🔥', '🤤', '❤️'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setCaption((prev) => (prev ? `${prev} ${em}` : em))}
                    className="text-sm sm:text-base hover:scale-125 transition-transform cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>

              {/* Instant 1-Tap Post Button */}
              <button
                onClick={handleSubmitBite}
                disabled={isSubmittingReview}
                className="bg-[#FF6B35] hover:bg-[#E85D2A] text-white p-2 rounded-full shadow-lg shadow-[#FF6B35]/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                title={isVi ? 'Đăng Bite ngay' : 'Post Bite'}
                id="btn-locket-send-bite"
              >
                {isSubmittingReview ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Optional Collapsed Ratings & Spot Contributor Toggle */}
            <div className="flex items-center justify-between pt-0.5 text-[11px] text-white/70">
              <button
                type="button"
                onClick={() => setShowAdvancedReview((prev) => !prev)}
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3 text-[#FFD166]" />
                <span>{isVi ? 'Đánh giá chi tiết (tùy chọn)' : 'Optional Review'}</span>
                {showAdvancedReview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenCommunitySpotModal({
                    imageUrl: originalEvidence,
                    prefillData: verificationResult?.aiAnalysis,
                    latitude: userCoords.lat,
                    longitude: userCoords.lng,
                  });
                }}
                className="text-[#FFD166] hover:underline cursor-pointer"
              >
                {isVi ? '+ Đóng góp quán mới' : '+ Add spot'}
              </button>
            </div>

            {/* Collapsed Advanced Rating Section */}
            {showAdvancedReview && (
              <div className="flex flex-col gap-2 pt-2 border-t border-white/10 animate-slide-up text-xs">
                {/* Taste */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white/80">{isVi ? 'Vị giác:' : 'Taste:'}</span>
                  <div className="flex gap-1.5">
                    {(['tasty', 'normal', 'bad'] as QuickRatingTaste[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setTasteRating(tasteRating === r ? null : r)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-heading font-medium cursor-pointer transition-all ${
                          tasteRating === r
                            ? 'bg-[#FF6B35] text-white font-bold'
                            : 'bg-white/10 text-white/80'
                        }`}
                      >
                        {r === 'tasty' ? '😍 Ngon' : r === 'normal' ? '😐 Tạm' : '💀 Dở'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white/80">{isVi ? 'Giá cả:' : 'Price:'}</span>
                  <div className="flex gap-1.5">
                    {(['good_value', 'fair', 'expensive'] as QuickRatingPrice[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriceRating(priceRating === p ? null : p)}
                        className={`px-2 py-1 rounded-full text-[11px] font-heading font-medium cursor-pointer transition-all ${
                          priceRating === p
                            ? 'bg-[#2EC4B6] text-white font-bold'
                            : 'bg-white/10 text-white/80'
                        }`}
                      >
                        {p === 'good_value' ? 'Rẻ' : p === 'fair' ? 'Hợp lý' : 'Đắt'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
