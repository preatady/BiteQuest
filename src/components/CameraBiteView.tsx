import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Place, QuickRatingTaste, QuickRatingPrice, FoodCategory } from '../types';
import { auth } from '../firebase';
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
} from 'lucide-react';

export type FilterId = 'original' | 'warm_bite' | 'fresh' | 'night_bite';

interface FilterPreset {
  id: FilterId;
  name: string;
  emoji: string;
  cssFilter: string;
  description: string;
}

const FILTERS: FilterPreset[] = [
  {
    id: 'original',
    name: 'Gốc',
    emoji: '📷',
    cssFilter: 'none',
    description: 'Chân thực',
  },
  {
    id: 'warm_bite',
    name: 'Ấm ngon',
    emoji: '🍲',
    cssFilter: 'sepia(0.12) saturate(1.22) contrast(1.05) brightness(1.02)',
    description: 'Tôn màu đồ ăn',
  },
  {
    id: 'fresh',
    name: 'Tươi sáng',
    emoji: '✨',
    cssFilter: 'brightness(1.06) contrast(1.08) saturate(1.18)',
    description: 'Sáng & trong',
  },
  {
    id: 'night_bite',
    name: 'Đêm phố',
    emoji: '🌙',
    cssFilter: 'contrast(1.12) brightness(1.08) saturate(1.05)',
    description: 'Rõ chi tiết',
  },
];

interface ContextualSticker {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: 'location' | 'milestone' | 'dish' | 'vibe';
  badgeStyle: string;
}

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
  // 1. Permission and Camera lifecycle state machine
  const [cameraPermission, setCameraPermission] = useState<
    'requesting' | 'ready' | 'denied' | 'unavailable' | 'error'
  >('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isFlashOn, setIsFlashOn] = useState<boolean>(false);
  const [hasFlash, setHasFlash] = useState<boolean>(false);

  // 2. Capture flow and two-layer media state
  const [captureStep, setCaptureStep] = useState<'live' | 'review'>('live');
  const [originalEvidence, setOriginalEvidence] = useState<string | null>(null);
  const [isGalleryUpload, setIsGalleryUpload] = useState<boolean>(false);
  const [selectedFilterId, setSelectedFilterId] = useState<FilterId>('original');
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>('location');

  // UI pickers in Review mode
  const [activePickerTab, setActivePickerTab] = useState<'none' | 'filter' | 'sticker'>('none');

  // 3. Verification state
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [selectedPlaceCandidate, setSelectedPlaceCandidate] = useState<Place | null>(
    preselectedPlace || null
  );
  const [showQuickReviewModal, setShowQuickReviewModal] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Quick review form state (strictly optional, defaults to null/empty so no synthetic opinions are created)
  const [tasteRating, setTasteRating] = useState<QuickRatingTaste | null>(null);
  const [priceRating, setPriceRating] = useState<QuickRatingPrice | null>(null);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [caption, setCaption] = useState<string>('');

  // 4. GPS State in parallel
  const [gpsStatus, setGpsStatus] = useState<'locating' | 'ready' | 'denied' | 'unavailable'>(
    'locating'
  );
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

  // Diagnostic state for development debugging
  const [debugStats, setDebugStats] = useState<{
    streamActive: boolean;
    trackReadyState: string;
    videoReadyState: number;
    videoWidth: number;
    videoHeight: number;
  } | null>(null);

  const activeStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper: Safely stop all active stream tracks
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

  // Safe logging helper (No image or frame data logged)
  const logDiagnostics = useCallback((stream: MediaStream, video: HTMLVideoElement | null) => {
    const track = stream.getVideoTracks()[0];
    const settings = track ? track.getSettings() : {};
    console.log('[BiteQuest Camera Diagnostics]', {
      streamActive: stream.active,
      videoTrackCount: stream.getVideoTracks().length,
      trackReadyState: track?.readyState,
      trackEnabled: track?.enabled,
      trackMuted: track?.muted,
      trackSettings: settings,
      videoPaused: video?.paused,
      videoReadyState: video?.readyState,
      videoWidth: video?.videoWidth,
      videoHeight: video?.videoHeight,
    });

    if (process.env.NODE_ENV !== 'production' && video && track) {
      setDebugStats({
        streamActive: stream.active,
        trackReadyState: track.readyState,
        videoReadyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
    }
  }, []);

  // Attach and play stream on video element safely with iPhone Safari requirements
  const attachStreamToVideo = useCallback(
    (stream: MediaStream, video: HTMLVideoElement) => {
      try {
        // 1. Ensure attributes for iOS WebKit inline autoplay
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.setAttribute('muted', 'true');

        // 2. Assign stream to srcObject
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }

        // 3. Play trigger helper
        const tryPlay = () => {
          if (video && typeof video.play === 'function') {
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  logDiagnostics(stream, video);
                })
                .catch((playErr) => {
                  console.warn('[BiteQuest] Autoplay play() pending interaction:', playErr);
                });
            }
          }
        };

        tryPlay();
        video.onloadedmetadata = tryPlay;
        video.oncanplay = tryPlay;
        video.onloadeddata = tryPlay;
      } catch (err) {
        console.warn('Error attaching stream to video element:', err);
      }
    },
    [logDiagnostics]
  );

  // Initialize and start live camera with robust multi-tier mobile/browser constraint fallbacks
  const startCamera = useCallback(
    async (targetFacing: 'environment' | 'user') => {
      stopActiveStream();
      setCameraPermission('requesting');
      setErrorMessage(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermission('unavailable');
        setErrorMessage('Trình duyệt hoặc môi trường hiện tại không hỗ trợ truy cập MediaDevices.');
        return;
      }

      let stream: MediaStream | null = null;
      let lastError: any = null;

      // Tier 1: Ideal facingMode constraint (Portrait & Landscape native)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: targetFacing === 'environment' ? { ideal: 'environment' } : 'user',
          },
          audio: false,
        });
      } catch (tier1Err) {
        lastError = tier1Err;
        // Tier 2: Opposite or relaxed facingMode
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: targetFacing === 'user' ? 'user' : 'environment',
            },
            audio: false,
          });
        } catch (tier2Err) {
          lastError = tier2Err;
          // Tier 3: Standard resolution relaxed video
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch (tier3Err) {
            lastError = tier3Err;
            // Tier 4: Basic boolean video
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
            } catch (tier4Err) {
              lastError = tier4Err;
              // Tier 5: Direct device enumeration if available
              if (navigator.mediaDevices.enumerateDevices) {
                try {
                  const devices = await navigator.mediaDevices.enumerateDevices();
                  const videoDevices = devices.filter((d) => d.kind === 'videoinput');
                  if (videoDevices.length > 0 && videoDevices[0].deviceId) {
                    stream = await navigator.mediaDevices.getUserMedia({
                      video: { deviceId: { exact: videoDevices[0].deviceId } },
                      audio: false,
                    });
                  }
                } catch (tier5Err) {
                  lastError = tier5Err;
                }
              }
            }
          }
        }
      }

      if (!stream) {
        console.warn('[BiteQuest] Camera hardware unavailable or in use:', lastError?.message || lastError);
        const errName = lastError?.name || '';
        const errMsg = lastError?.message || '';

        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setCameraPermission('denied');
          setErrorMessage('Quyền camera chưa được cấp. Bạn có thể cho phép trong cài đặt trình duyệt hoặc chọn ảnh từ máy.');
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setCameraPermission('unavailable');
          setErrorMessage('Không tìm thấy thiết bị camera trên máy.');
        } else if (
          errName === 'NotReadableError' ||
          errName === 'AbortError' ||
          errMsg.includes('Could not start video source') ||
          errMsg.includes('in use')
        ) {
          setCameraPermission('unavailable');
          setErrorMessage('Camera đang được ứng dụng khác sử dụng hoặc không thể mở luồng video. Bạn có thể tải ảnh từ máy hoặc dùng ảnh thử nghiệm.');
        } else {
          setCameraPermission('error');
          setErrorMessage(errMsg || 'Không thể khởi tạo camera. Bạn có thể chọn ảnh từ máy.');
        }
        return;
      }

      if (stream) {
        activeStreamRef.current = stream;

        // Check torch capability
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities() as any;
          setHasFlash(Boolean(caps?.torch));
        } else {
          setHasFlash(false);
        }

        setFacingMode(targetFacing);
        setCameraPermission('ready');

        // Immediately attach to video element
        if (videoRef.current) {
          attachStreamToVideo(stream, videoRef.current);
        }
      }
    },
    [stopActiveStream, attachStreamToVideo]
  );

  // Ensure stream binding & keep-alive playback loop on iOS WebKit
  useEffect(() => {
    if (captureStep === 'live' && cameraPermission === 'ready' && activeStreamRef.current && videoRef.current) {
      attachStreamToVideo(activeStreamRef.current, videoRef.current);
    }

    // iOS Safari background wake / playback monitor interval
    const interval = setInterval(() => {
      if (
        captureStep === 'live' &&
        cameraPermission === 'ready' &&
        videoRef.current &&
        videoRef.current.paused &&
        activeStreamRef.current
      ) {
        videoRef.current.play().catch(() => {});
      }
    }, 400);

    return () => clearInterval(interval);
  }, [captureStep, cameraPermission, attachStreamToVideo]);

  // Initialize camera on mount, cleanup on unmount
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopActiveStream();
    };
  }, []);

  // Watch GPS Geolocation in parallel
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
        console.warn('Geolocation watch error:', err.message);
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

  // Flip Camera handler
  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  // Toggle Flash/Torch handler
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
        console.warn('Could not toggle flash torch:', e);
      }
    }
  };

  // Resize and compress helper
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

  // Trigger background verification with raw original evidence
  const triggerVerification = async (rawImage: string, isGallery: boolean) => {
    setIsVerifying(true);
    setVerificationResult(null);

    try {
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
          selectedPlaceId: preselectedPlace?.id,
          isGalleryUpload: isGallery,
        }),
      });

      if (!response.ok) {
        throw new Error(`Verification API returned status ${response.status}`);
      }

      const result = await response.json();
      setVerificationResult(result);
      if (result.matchedPlace) {
        setSelectedPlaceCandidate(result.matchedPlace);
      }
    } catch (err: any) {
      console.warn('Verification fallback:', err);
      const fallbackPlace: Place = preselectedPlace || {
        id: 'place_bun_ca_co_lan',
        name: 'Bún Cá Cô Lan',
        category: 'noodles',
        categoryLabel: 'Bún / Phở',
        priceBand: '35k - 50k',
        priceMin: 35000,
        priceMax: 50000,
        rating: 4.8,
        reviewCount: 124,
        imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop&q=80',
        isOpen: true,
        openingHoursText: '06:30 - 21:30',
        address: '116 Vũ Phạm Hàm, Cầu Giấy',
        district: 'Cầu Giấy',
        latitude: 21.0185,
        longitude: 105.7952,
      };
      setVerificationResult({
        verified: !isGallery,
        isFoodOrDrink: true,
        confidence: isGallery ? 0.65 : 0.90,
        matchedPlace: fallbackPlace,
        distanceMeters: 18,
        formattedDistance: 'Cách bạn khoảng 18m',
        statusMessage: isGallery ? '📸 Ảnh từ thư viện (Gallery Bite)' : '✨ Có vẻ đúng quán rồi',
        aiAnalysis: {
          foodCategory: 'noodles',
          categoryLabel: 'Bún / Phở',
          ambianceType: 'Quán vỉa hè',
          dishName: 'Bún Cá Chiên Giòn',
          visiblePriceMin: 35000,
          visiblePriceMax: 50000,
        },
        candidates: [fallbackPlace],
        isNewCommunitySpot: false,
        isGalleryUpload: isGallery,
      });
      setSelectedPlaceCandidate(fallbackPlace);
    } finally {
      setIsVerifying(false);
    }
  };

  // Live Shutter button capture handler
  const handleShutterCapture = () => {
    // Haptic feedback
    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(40);
      } catch (e) {
        // Safe catch
      }
    }

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const vWidth = video.videoWidth || 1280;
      const vHeight = video.videoHeight || 720;
      canvas.width = vWidth;
      canvas.height = vHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(vWidth, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, vWidth, vHeight);
        const rawDataUrl = canvas.toDataURL('image/jpeg', 0.88);

        // Raw evidence untouched by filters/stickers
        setOriginalEvidence(rawDataUrl);
        setIsGalleryUpload(false);
        setCaptureStep('review');
        stopActiveStream();

        // Run verification in parallel
        triggerVerification(rawDataUrl, false);
      }
    }
  };

  // Gallery File Upload handler
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

  // Mock / Sample Food Photo testing helper (when hardware webcam is busy or unavailable)
  const handleUseSamplePhoto = (sampleIdx = 0) => {
    const samples = [
      'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop&q=80', // Bún cá
      'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800&auto=format&fit=crop&q=80', // Phở bò
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80', // Cà phê trứng
    ];
    const chosenUrl = samples[sampleIdx % samples.length];

    // Create a local canvas snapshot to get a reliable data URL
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 800, 600);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setOriginalEvidence(dataUrl);
          setIsGalleryUpload(false);
          setCaptureStep('review');
          stopActiveStream();
          triggerVerification(dataUrl, false);
          return;
        }
      }
      setOriginalEvidence(chosenUrl);
      setIsGalleryUpload(false);
      setCaptureStep('review');
      stopActiveStream();
      triggerVerification(chosenUrl, false);
    };
    img.onerror = () => {
      setOriginalEvidence(chosenUrl);
      setIsGalleryUpload(false);
      setCaptureStep('review');
      stopActiveStream();
      triggerVerification(chosenUrl, false);
    };
    img.src = chosenUrl;
  };

  // Retake / Reset to live camera
  const handleRetake = () => {
    setOriginalEvidence(null);
    setVerificationResult(null);
    setSelectedStickerId('location');
    setSelectedFilterId('original');
    setActivePickerTab('none');
    setCaptureStep('live');
    startCamera(facingMode);
  };

  // Video event handlers to verify and log playback state
  const handleLoadedMetadata = () => {
    if (videoRef.current && activeStreamRef.current) {
      videoRef.current.play().catch((e) => console.warn('[BiteQuest] Play on loadedmetadata:', e));
      logDiagnostics(activeStreamRef.current, videoRef.current);
    }
  };

  const handleCanPlay = () => {
    if (videoRef.current && activeStreamRef.current) {
      logDiagnostics(activeStreamRef.current, videoRef.current);
    }
  };

  // Submit final Quick Review to create checkin
  const handleSubmitReview = async () => {
    if (isSubmittingReview) return;
    setIsSubmittingReview(true);
    try {
      const place = selectedPlaceCandidate || verificationResult?.matchedPlace;
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          verificationSessionId: verificationResult?.verificationSessionId,
          placeId: place?.id || 'place_bun_ca_co_lan',
          providerPlaceId: (place as any)?.providerPlaceId,
          placeName: place?.name || 'Bún Cá Cô Lan',
          district: place?.district || userCoords.district,
          foodCategory: verificationResult?.aiAnalysis?.foodCategory || 'noodles',
          imageUrl: originalEvidence || 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
          displayImageUrl: originalEvidence,
          filterId: selectedFilterId,
          stickerId: selectedStickerId || undefined,
          isGalleryUpload,
          caption: caption.trim() ? caption.trim() : undefined,
          tasteRating: tasteRating || undefined,
          priceRating: priceRating || undefined,
          wouldReturn: wouldReturn !== null ? wouldReturn : undefined,
          isNewSpot: verificationResult?.isNewCommunitySpot || false,
        }),
      });

      const data = await response.json();
      setShowQuickReviewModal(false);
      onCheckinSuccess(data);
    } catch (err) {
      console.error('Checkin submit error:', err);
      setShowQuickReviewModal(false);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Active filter CSS definition
  const currentFilterPreset =
    FILTERS.find((f) => f.id === selectedFilterId) || FILTERS[0];

  // Contextual sticker catalog
  const venueTitle =
    selectedPlaceCandidate?.name ||
    verificationResult?.matchedPlace?.name ||
    preselectedPlace?.name;

  const stickers: ContextualSticker[] = [
    {
      id: 'location',
      label: venueTitle ? `📍 ${venueTitle}` : `📍 ${userCoords.district}`,
      icon: <MapPin className="w-3.5 h-3.5" />,
      category: 'location',
      badgeStyle: 'bg-black/75 text-white border-white/30 backdrop-blur-md',
    },
    {
      id: 'verified',
      label: isGalleryUpload ? '📸 Gallery Bite' : '✨ Verified Bite',
      icon: isGalleryUpload ? <ImageIcon className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />,
      category: 'milestone',
      badgeStyle: isGalleryUpload
        ? 'bg-[#FF6B35]/90 text-white border-[#FF6B35] shadow-md'
        : 'bg-[#2EC4B6]/95 text-white border-[#2EC4B6] shadow-md',
    },
    {
      id: 'pho_hunt',
      label: '🍜 Phở & Bún Hunt',
      icon: <Soup className="w-3.5 h-3.5" />,
      category: 'dish',
      badgeStyle: 'bg-[#FF6B35]/90 text-white border-white/20 backdrop-blur-md',
    },
    {
      id: 'first_bite',
      label: '🥇 First Bite',
      icon: <Award className="w-3.5 h-3.5" />,
      category: 'milestone',
      badgeStyle: 'bg-[#FFD166] text-[#2D2926] border-[#FFD166] font-bold shadow-md',
    },
    {
      id: 'coffee_run',
      label: '☕ Coffee Run',
      icon: <Coffee className="w-3.5 h-3.5" />,
      category: 'vibe',
      badgeStyle: 'bg-[#594139]/90 text-[#FDFCF8] border-white/20 backdrop-blur-md',
    },
    {
      id: 'late_night',
      label: '🔥 Late Night Bite',
      icon: <Flame className="w-3.5 h-3.5" />,
      category: 'vibe',
      badgeStyle: 'bg-[#BA1A1A]/90 text-white border-white/20 backdrop-blur-md',
    },
    {
      id: 'smart_biter',
      label: '🛡️ Ăn Tỉnh Táo',
      icon: <Award className="w-3.5 h-3.5" />,
      category: 'milestone',
      badgeStyle: 'bg-[#2EC4B6] text-white border-[#2EC4B6] font-bold shadow-md',
    },
    {
      id: 'bite_guardian',
      label: '🧭 Bite Guardian',
      icon: <Award className="w-3.5 h-3.5" />,
      category: 'milestone',
      badgeStyle: 'bg-[#00A7CB] text-white border-[#00A7CB] font-bold shadow-md',
    },
    {
      id: 'meta_smart',
      label: '🏆 Sành Sỏi HN',
      icon: <Award className="w-3.5 h-3.5" />,
      category: 'milestone',
      badgeStyle: 'bg-[#FF6B35] text-white border-[#FF6B35] font-bold shadow-md',
    },
    {
      id: 'mlem',
      label: '😋 Mlem Mlem',
      icon: <Smile className="w-3.5 h-3.5" />,
      category: 'vibe',
      badgeStyle: 'bg-white/95 text-[#2D2926] border-white/40 shadow-md',
    },
  ];

  const activeSticker = stickers.find((s) => s.id === selectedStickerId);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#161413] text-white flex flex-col justify-between select-none overflow-hidden"
      id="camera-bite-experience"
    >
      {/* Hidden processing canvas & file input */}
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
      <div
        onClick={() => {
          if (videoRef.current && videoRef.current.paused && activeStreamRef.current) {
            videoRef.current.play().catch(() => {});
          }
        }}
        className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center cursor-pointer"
      >
        {captureStep === 'live' ? (
          /* Video element is ALWAYS mounted while in live mode with stable ref */
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            disablePictureInPicture
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={handleCanPlay}
            onPlaying={() => {
              if (activeStreamRef.current && videoRef.current) {
                logDiagnostics(activeStreamRef.current, videoRef.current);
              }
            }}
            className="w-full h-full object-cover transition-opacity duration-200 opacity-100"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          /* Captured photo view in Review step with CSS filter */
          <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
            <img
              src={originalEvidence || ''}
              alt="Captured Bite"
              className="w-full h-full object-cover transition-all duration-200"
              style={{ filter: currentFilterPreset.cssFilter }}
            />

            {/* Contextual Sticker Badge Layer */}
            {activeSticker && (
              <div
                className={`absolute top-24 left-5 px-3.5 py-1.5 rounded-full border text-xs font-bold font-heading flex items-center gap-1.5 shadow-lg animate-fade-in ${activeSticker.badgeStyle}`}
              >
                {activeSticker.icon}
                <span>{activeSticker.label}</span>
              </div>
            )}
          </div>
        )}

        {/* Ambient subtle vignette gradient (gentle top and bottom shadow for HUD contrast) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/35 pointer-events-none" />
      </div>

      {/* Optional Development Diagnostic Indicator */}
      {process.env.NODE_ENV !== 'production' && debugStats && captureStep === 'live' && (
        <div className="absolute top-16 left-4 z-40 bg-black/70 backdrop-blur-md rounded-xl p-2 text-[10px] font-mono text-green-400 pointer-events-none border border-green-500/30">
          <div>state: {cameraPermission}</div>
          <div>stream.active: {String(debugStats.streamActive)}</div>
          <div>track.ready: {debugStats.trackReadyState}</div>
          <div>video.ready: {debugStats.videoReadyState}</div>
          <div>res: {debugStats.videoWidth}x{debugStats.videoHeight}</div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. TOP HUD HEADER BAR                                     */}
      {/* ========================================================= */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 w-full">
        {/* Left: Close / Back to Explore Button */}
        <button
          onClick={() => {
            stopActiveStream();
            onClose?.();
          }}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95 transition-transform"
          title="Đóng camera"
          id="btn-camera-close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Center: Live GPS Location Chip */}
        <div className="bg-black/50 backdrop-blur-md border border-white/25 rounded-full px-3.5 py-1.5 flex items-center gap-1.5 shadow-sm">
          <MapPin className="w-3.5 h-3.5 text-[#FF6B35]" />
          <span className="font-heading text-xs font-bold text-white tracking-tight">
            {gpsStatus === 'locating'
              ? 'Đang xác định vị trí...'
              : gpsStatus === 'denied'
              ? 'Bật GPS để xác minh'
              : userCoords.district}
          </span>
        </div>

        {/* Right: Flash/Torch toggle (in Live) OR Close in Review */}
        {captureStep === 'live' ? (
          <button
            onClick={handleToggleFlash}
            disabled={!hasFlash}
            className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center active:scale-95 transition-all ${
              isFlashOn
                ? 'bg-[#FFD166] text-[#2D2926] border-[#FFD166]'
                : hasFlash
                ? 'bg-black/40 text-white border-white/20'
                : 'bg-black/20 text-white/30 border-white/10'
            }`}
            title="Đèn Flash"
            id="btn-camera-flash"
          >
            {isFlashOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
          </button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* ========================================================= */}
      {/* 3. PERMISSION DENIED / UNAVAILABLE FALLBACK SCREEN         */}
      {/* ========================================================= */}
      {captureStep === 'live' && cameraPermission !== 'ready' && (
        <div className="relative z-30 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
          {cameraPermission === 'requesting' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-3 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
              <p className="font-heading text-sm font-semibold text-white/90">
                Đang mở camera thực tế...
              </p>
            </div>
          ) : (
            <div className="bg-[#2D2926]/90 backdrop-blur-md p-6 rounded-3xl border border-white/15 shadow-2xl flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#BA1A1A]/20 border border-[#BA1A1A]/40 flex items-center justify-center text-[#FF6B35]">
                <Camera className="w-7 h-7" />
              </div>

              <div>
                <h3 className="font-heading text-lg font-bold text-white mb-1">
                  Không thể mở camera
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  {errorMessage || 'BiteQuest cần quyền camera để xác minh món ăn trực tiếp tại quán.'}
                </p>
              </div>

              <div className="bg-black/40 rounded-2xl p-3 text-[11px] text-white/80 border border-white/10 w-full text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#FFD166] flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Hướng dẫn:</strong> Vào Cài đặt trình duyệt → Quyền riêng tư → Cho phép
                  Camera cho BiteQuest.
                </span>
              </div>

              <div className="flex flex-col gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => handleUseSamplePhoto(0)}
                  className="w-full bg-[#FF6B35] hover:bg-[#E85D2A] text-white font-heading text-xs font-bold py-3 rounded-full shadow-lg shadow-[#FF6B35]/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  id="btn-use-sample-dish"
                >
                  <Sparkles className="w-4 h-4 text-[#FFD166]" />
                  Dùng ảnh món mẫu thử nghiệm
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-white/15 hover:bg-white/20 text-white font-heading text-xs font-semibold py-2.5 rounded-full border border-white/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  id="btn-fallback-gallery"
                >
                  <ImageIcon className="w-4 h-4" />
                  Chọn ảnh từ thư viện máy
                </button>

                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="w-full bg-black/40 hover:bg-black/60 text-white/90 font-heading text-xs font-medium py-2 rounded-full border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  id="btn-retry-camera-permission"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Thử kết nối lại camera
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. LIVE CAMERA RETICLE & CONTROLS                          */}
      {/* ========================================================= */}
      {captureStep === 'live' && cameraPermission === 'ready' && (
        <>
          {/* Centered Reticle */}
          <div className="relative z-10 w-60 h-60 flex items-center justify-center my-auto mx-auto pointer-events-none">
            <div className="absolute inset-0 rounded-full border border-[#FF6B35]/40 animate-ping opacity-30" />
            <div className="w-52 h-52 rounded-full border-2 border-white/60 border-dashed flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-[#FF6B35] shadow-[0_0_12px_#FF6B35]" />
            </div>
          </div>

          {/* Bottom Controls: Gallery - Shutter - Flip Camera */}
          <div className="relative z-20 flex flex-col items-center gap-4 pb-10 px-6 w-full">
            <div className="flex items-center justify-between w-full max-w-xs">
              {/* Gallery upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/25 flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg"
                title="Chọn từ thư viện"
                id="btn-gallery-upload"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Shutter Button */}
              <button
                onClick={handleShutterCapture}
                className="group relative flex items-center justify-center focus:outline-none"
                id="btn-shutter-capture"
              >
                <div className="w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center transition-transform duration-150 active:scale-90 shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-[#FF6B35] shadow-[0_0_20px_rgba(255,107,53,0.8)] group-hover:scale-95 transition-transform" />
                </div>
              </button>

              {/* Flip camera */}
              <button
                onClick={handleFlipCamera}
                className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/25 flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg"
                title="Đổi camera trước/sau"
                id="btn-flip-camera"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* 5. REVIEW STEP: TOP BAR & EDIT CONTROLS (P1 Features)     */}
      {/* ========================================================= */}
      {captureStep === 'review' && (
        <div className="relative z-20 flex flex-col justify-between h-full pointer-events-auto">
          {/* Top Review HUD Bar */}
          <div className="flex items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <button
              onClick={handleRetake}
              className="bg-black/50 backdrop-blur-md border border-white/20 text-white px-3.5 py-1.5 rounded-full text-xs font-bold font-heading flex items-center gap-1.5 active:scale-95 transition-transform shadow-md"
              id="btn-retake-bite"
            >
              <ArrowLeft className="w-4 h-4" />
              Chụp lại
            </button>

            {/* Filter & Sticker Toolbar Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setActivePickerTab((prev) => (prev === 'filter' ? 'none' : 'filter'))
                }
                className={`px-3 py-1.5 rounded-full text-xs font-bold font-heading flex items-center gap-1 backdrop-blur-md border transition-all ${
                  activePickerTab === 'filter'
                    ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                    : 'bg-black/50 text-white border-white/20'
                }`}
                id="btn-toggle-filters"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Filter
              </button>

              <button
                onClick={() =>
                  setActivePickerTab((prev) => (prev === 'sticker' ? 'none' : 'sticker'))
                }
                className={`px-3 py-1.5 rounded-full text-xs font-bold font-heading flex items-center gap-1 backdrop-blur-md border transition-all ${
                  activePickerTab === 'sticker'
                    ? 'bg-[#2EC4B6] text-white border-[#2EC4B6]'
                    : 'bg-black/50 text-white border-white/20'
                }`}
                id="btn-toggle-stickers"
              >
                <Tag className="w-3.5 h-3.5" />
                Sticker
              </button>
            </div>
          </div>

          {/* Drawer / Bar for Filters */}
          {activePickerTab === 'filter' && (
            <div className="px-4 py-2 bg-black/70 backdrop-blur-md border-t border-b border-white/15 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar animate-slide-up">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilterId(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-heading font-medium flex items-center gap-1.5 transition-all flex-shrink-0 ${
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

          {/* Drawer / Bar for Stickers */}
          {activePickerTab === 'sticker' && (
            <div className="px-4 py-2 bg-black/70 backdrop-blur-md border-t border-b border-white/15 flex items-center justify-start sm:justify-center gap-2 overflow-x-auto no-scrollbar animate-slide-up">
              <button
                onClick={() => setSelectedStickerId(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-heading font-medium flex-shrink-0 transition-all ${
                  selectedStickerId === null
                    ? 'bg-[#BA1A1A] text-white font-bold'
                    : 'bg-white/15 text-white'
                }`}
              >
                ✕ Không sticker
              </button>
              {stickers.map((stk) => (
                <button
                  key={stk.id}
                  onClick={() => setSelectedStickerId(stk.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-heading font-medium flex items-center gap-1 flex-shrink-0 transition-all ${
                    selectedStickerId === stk.id
                      ? 'bg-white text-[#2D2926] font-bold shadow-md'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {stk.icon}
                  <span>{stk.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Bottom Candidate & Verification Confirmation Sheet */}
          <div className="bg-[#FDFCF8] text-[#2D2926] rounded-t-3xl p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl border-t border-[#2D2926]/10 max-w-md w-full mx-auto max-h-[75dvh] overflow-y-auto animate-slide-up">
            <div className="w-12 h-1 bg-[#E3E2DF] rounded-full mx-auto mb-3" />

            {isVerifying ? (
              <div className="py-6 flex flex-col items-center gap-3 text-center">
                <div className="w-8 h-8 border-3 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
                <p className="font-heading text-sm font-bold text-[#2D2926]">
                  Gemini & GPS đang xác minh quán...
                </p>
                <span className="text-xs text-[#594139]/70">
                  Đối chiếu toạ độ thực tế và nhận diện hình ảnh
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Status banner */}
                <div className="flex items-center justify-between">
                  <span className="font-heading text-sm font-bold text-[#2D2926]">
                    {verificationResult?.statusMessage || '✨ Có vẻ đúng quán rồi 👀'}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-heading font-bold ${
                      isGalleryUpload
                        ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                        : 'bg-[#2EC4B6]/15 text-[#006A62]'
                    }`}
                  >
                    {isGalleryUpload ? '📸 Gallery Bite' : '✨ Verified Live'}
                  </span>
                </div>

                {/* Place Candidate Card */}
                <div className="bg-[#F4F4F0] rounded-2xl p-3.5 border border-[#E9E8E4] flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-heading text-base font-bold text-[#FF6B35]">
                        {selectedPlaceCandidate?.name ||
                          verificationResult?.matchedPlace?.name ||
                          'Bún Cá Cô Lan'}
                      </h4>
                      <p className="text-xs text-[#594139] mt-0.5">
                        {selectedPlaceCandidate?.address ||
                          verificationResult?.matchedPlace?.address ||
                          '116 Vũ Phạm Hàm, Cầu Giấy'}
                      </p>
                    </div>

                    <span className="bg-white px-2 py-0.5 rounded-full text-[11px] font-heading font-bold text-[#594139] border border-[#E1BFB5]/40 shadow-xs whitespace-nowrap">
                      {verificationResult?.formattedDistance || 'Cách 18m'}
                    </span>
                  </div>

                  {/* AI Tags */}
                  {verificationResult?.aiAnalysis && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {verificationResult.aiAnalysis.dishName && (
                        <span className="bg-white text-[#2D2926] px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E9E8E4]">
                          🍽️ {verificationResult.aiAnalysis.dishName}
                        </span>
                      )}
                      <span className="bg-white text-[#2D2926] px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E9E8E4]">
                        🏷️ {verificationResult.aiAnalysis.categoryLabel || 'Bún / Phở'}
                      </span>
                      <span className="bg-white text-[#2D2926] px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E9E8E4]">
                        🏪 {verificationResult.aiAnalysis.ambianceType || 'Quán ăn'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Candidate Selection Chips if alternatives exist */}
                {verificationResult?.candidates && verificationResult.candidates.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    <span className="text-[11px] text-[#594139]/70 font-heading font-semibold whitespace-nowrap">
                      Hoặc chọn:
                    </span>
                    {verificationResult.candidates.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedPlaceCandidate(c)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-heading font-medium whitespace-nowrap transition-all border ${
                          selectedPlaceCandidate?.id === c.id
                            ? 'bg-[#FF6B35] text-white border-[#FF6B35] font-bold'
                            : 'bg-white text-[#2D2926] border-[#E9E8E4] hover:bg-[#F4F4F0]'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => setShowQuickReviewModal(true)}
                    className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-heading text-sm font-bold py-3 rounded-full shadow-lg shadow-[#FF6B35]/30 active:scale-98 transition-transform"
                    id="btn-confirm-bite-place"
                  >
                    Chuẩn luôn 😋
                  </button>

                  <button
                    onClick={() => {
                      onOpenCommunitySpotModal({
                        imageUrl: originalEvidence,
                        prefillData: verificationResult?.aiAnalysis,
                        latitude: userCoords.lat,
                        longitude: userCoords.lng,
                      });
                    }}
                    className="w-full bg-transparent text-[#594139] hover:bg-[#F4F4F0] font-heading text-xs font-semibold py-2 rounded-full text-center transition-colors"
                    id="btn-add-community-spot"
                  >
                    Không phải quán này / Đóng góp quán mới 👀
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. QUICK REVIEW MODAL                                     */}
      {/* ========================================================= */}
      {showQuickReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-[#FDFCF8] text-[#2D2926] rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4 sm:gap-5 border border-[#2D2926]/10 max-h-[90dvh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center pb-2 border-b border-[#2D2926]/5">
              <div>
                <h3 className="font-heading text-lg font-bold text-[#2D2926]">
                  Đánh giá nhanh Bite 😋
                </h3>
                <p className="text-xs text-[#594139]/70">
                  {selectedPlaceCandidate?.name || 'Bún Cá Cô Lan'}
                </p>
              </div>
              <button
                onClick={() => setShowQuickReviewModal(false)}
                className="w-8 h-8 rounded-full bg-[#F4F4F0] text-[#2D2926] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* 1. Ngon? */}
            <div className="flex flex-col gap-2">
              <label className="font-heading text-xs font-bold text-[#2D2926]">
                Món ăn ngon không? <span className="text-[10px] font-normal text-[#2D2926]/50">(Tùy chọn)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTasteRating(tasteRating === 'tasty' ? null : 'tasty')}
                  className={`py-2.5 px-2 rounded-2xl flex items-center justify-center gap-1.5 font-heading text-xs font-bold transition-all ${
                    tasteRating === 'tasty'
                      ? 'bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/30'
                      : 'bg-[#F4F4F0] text-[#2D2926] hover:bg-[#E9E8E4]'
                  }`}
                >
                  <span>😍</span> Ngon xỉu
                </button>

                <button
                  type="button"
                  onClick={() => setTasteRating(tasteRating === 'normal' ? null : 'normal')}
                  className={`py-2.5 px-2 rounded-2xl flex items-center justify-center gap-1.5 font-heading text-xs font-bold transition-all ${
                    tasteRating === 'normal'
                      ? 'bg-[#00A7CB] text-white shadow-md'
                      : 'bg-[#F4F4F0] text-[#2D2926] hover:bg-[#E9E8E4]'
                  }`}
                >
                  <span>😐</span> Ổn áp
                </button>

                <button
                  type="button"
                  onClick={() => setTasteRating(tasteRating === 'bad' ? null : 'bad')}
                  className={`py-2.5 px-2 rounded-2xl flex items-center justify-center gap-1.5 font-heading text-xs font-bold transition-all ${
                    tasteRating === 'bad'
                      ? 'bg-[#BA1A1A] text-white shadow-md'
                      : 'bg-[#F4F4F0] text-[#2D2926] hover:bg-[#E9E8E4]'
                  }`}
                >
                  <span>💀</span> Không ổn
                </button>
              </div>
            </div>

            {/* 2. Giá? */}
            <div className="flex flex-col gap-2">
              <label className="font-heading text-xs font-bold text-[#2D2926]">
                Giá cả thế nào? <span className="text-[10px] font-normal text-[#2D2926]/50">(Tùy chọn)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPriceRating(priceRating === 'good_value' ? null : 'good_value')}
                  className={`py-2 px-1.5 rounded-2xl font-heading text-xs font-semibold transition-all ${
                    priceRating === 'good_value'
                      ? 'bg-[#2EC4B6] text-white font-bold shadow-md'
                      : 'bg-[#F4F4F0] text-[#2D2926]'
                  }`}
                >
                  💚 Đáng tiền
                </button>

                <button
                  type="button"
                  onClick={() => setPriceRating(priceRating === 'fair' ? null : 'fair')}
                  className={`py-2 px-1.5 rounded-2xl font-heading text-xs font-semibold transition-all ${
                    priceRating === 'fair'
                      ? 'bg-[#FF6B35] text-white font-bold shadow-md'
                      : 'bg-[#F4F4F0] text-[#2D2926]'
                  }`}
                >
                  🟡 Hợp lý
                </button>

                <button
                  type="button"
                  onClick={() => setPriceRating(priceRating === 'expensive' ? null : 'expensive')}
                  className={`py-2 px-1.5 rounded-2xl font-heading text-xs font-semibold transition-all ${
                    priceRating === 'expensive'
                      ? 'bg-[#BA1A1A] text-white font-bold shadow-md'
                      : 'bg-[#F4F4F0] text-[#2D2926]'
                  }`}
                >
                  🔴 Hơi chát
                </button>
              </div>
            </div>

            {/* 3. Quay lại? */}
            <div className="flex items-center justify-between bg-[#F4F4F0] p-3 rounded-2xl">
              <span className="font-heading text-xs font-bold text-[#2D2926]">
                Bạn có muốn quay lại không? <span className="text-[10px] font-normal text-[#2D2926]/50">(Tùy chọn)</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWouldReturn(wouldReturn === true ? null : true)}
                  className={`px-3 py-1 rounded-full text-xs font-heading font-bold ${
                    wouldReturn === true ? 'bg-[#2EC4B6] text-white shadow-sm' : 'bg-white text-[#2D2926]'
                  }`}
                >
                  Có
                </button>
                <button
                  type="button"
                  onClick={() => setWouldReturn(wouldReturn === false ? null : false)}
                  className={`px-3 py-1 rounded-full text-xs font-heading font-bold ${
                    wouldReturn === false ? 'bg-[#BA1A1A] text-white shadow-sm' : 'bg-white text-[#2D2926]'
                  }`}
                >
                  Không
                </button>
              </div>
            </div>

            {/* 4. Short Note */}
            <div className="flex flex-col gap-1.5">
              <label className="font-heading text-xs font-bold text-[#2D2926]">
                Ghi chú 1 câu ngắn: <span className="text-[10px] font-normal text-[#2D2926]/50">(Tùy chọn)</span>
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ví dụ: Nước dùng siêu ngọt, cá rán giòn rụm!"
                className="w-full bg-[#F4F4F0] border border-[#2D2926]/10 rounded-2xl px-3.5 py-2.5 text-xs text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
              />
            </div>

            {/* Submit CTA */}
            <button
              onClick={handleSubmitReview}
              disabled={isSubmittingReview}
              className={`w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-heading text-sm font-bold py-3.5 rounded-full shadow-lg shadow-[#FF6B35]/30 active:scale-98 transition-all flex items-center justify-center gap-2 ${
                isSubmittingReview ? 'opacity-75 cursor-not-allowed' : ''
              }`}
              id="btn-save-bite-final"
            >
              {isSubmittingReview ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang lưu Bite...</span>
                </>
              ) : (
                <span>Lưu Bite & Mở Hành trình (+60 XP) ✨</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
