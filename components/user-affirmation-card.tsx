'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ImageIcon,
  Loader2,
  Play,
  Square,
  ChevronDown,
  Mic,
  Check,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { firebaseDb, firebaseStorage } from '@/lib/firebase/client';
import type { UserAffirmation } from '@/hooks/use-user-affirmations';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { AffirmationImageDialog } from '@/components/affirmation-image-dialog';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { categories } from '@/components/category-grid';
import {
  calculateCreditCost,
  hasEnoughCredits,
  PERSONAL_IMAGE_COST,
  VOICE_CLONE_COST,
} from '@/lib/credit-utils';

const CATEGORY_GRADIENT_MAP = categories.reduce<
  Record<string, { from: string; to: string }>
>((acc, item) => {
  acc[item.id] = item.gradient;
  return acc;
}, {});

const FIREBASE_HOST = 'firebasestorage.googleapis.com';
const REPLICATE_HOST_PATTERNS = [
  'replicate.delivery',
  'replicatecdn',
  'replicateusercontent',
];

interface UserAffirmationCardProps {
  affirmation: UserAffirmation;
  showFavoriteBadge?: boolean;
}

export function UserAffirmationCard({
  affirmation,
  showFavoriteBadge = true,
}: UserAffirmationCardProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [voices, setVoices] = useState<
    Array<{ id: string; name: string; description?: string }>
  >([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioUrlIsObjectRef = useRef(false);
  const [isFavorite, setIsFavorite] = useState(affirmation.favorite);
  const [useMyImage, setUseMyImage] = useState(false);
  const [useMyVoice, setUseMyVoice] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>(
    affirmation.audioUrls ?? {}
  );
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const personalImageOptOutRef = useRef(false);

  const favoriteDocRef = useRef<ReturnType<typeof doc> | null>(null);

  const hasPersonalImages = useMemo(
    () => Boolean(profile?.portraitImageUrl && profile?.fullBodyImageUrl),
    [profile?.portraitImageUrl, profile?.fullBodyImageUrl]
  );
  const hasPersonalVoice = useMemo(
    () => Boolean(profile?.voiceCloneId),
    [profile?.voiceCloneId]
  );
  const showImageToggle = !resolvedImageUrl;

  const demographicContext = useMemo(() => {
    if (!profile) return undefined;
    const { ageRange, gender, ethnicity, nationality } = profile;
    if (!ageRange && !gender && !ethnicity && !nationality) return undefined;
    return {
      ageRange: ageRange ?? undefined,
      gender: gender ?? undefined,
      ethnicity: ethnicity ?? undefined,
      nationality: nationality ?? undefined,
    };
  }, [profile]);

  const categoryGradient = CATEGORY_GRADIENT_MAP[affirmation.categoryId];
  const badgeStyle = categoryGradient
    ? {
        backgroundImage: `linear-gradient(135deg, ${categoryGradient.from}, ${categoryGradient.to})`,
        color: '#1f2937',
      }
    : undefined;

  useEffect(() => {
    if (user?.uid) {
      favoriteDocRef.current = doc(
        firebaseDb,
        'users',
        user.uid,
        'affirmations',
        affirmation.id
      );
    } else {
      favoriteDocRef.current = null;
    }
    setIsFavorite(affirmation.favorite);
  }, [affirmation.favorite, affirmation.id, user?.uid]);

  useEffect(() => {
    setAudioUrls(affirmation.audioUrls ?? {});
  }, [affirmation.audioUrls]);

  const persistImageFromUrl = useCallback(
    async (sourceUrl: string) => {
      if (!favoriteDocRef.current || !user) {
        return sourceUrl;
      }
      try {
        const response = await fetch(sourceUrl, {
          mode: 'cors',
          credentials: 'omit',
        });
        if (!response.ok) {
          console.warn(
            '[affirmation-card] Image fetch failed, using original URL',
            response.status
          );
          return sourceUrl;
        }
        const blob = await response.blob();
        const extension = blob.type?.split('/')?.[1] ?? 'jpg';
        const storageRef = ref(
          firebaseStorage,
          `users/${user.uid}/affirmations/${
            affirmation.id
          }/images/generated-${Date.now()}.${extension}`
        );
        await uploadBytes(storageRef, blob, {
          contentType: blob.type ?? 'image/jpeg',
        });
        const downloadUrl = await getDownloadURL(storageRef);
        await updateDoc(favoriteDocRef.current, {
          imageUrl: downloadUrl,
          updatedAt: serverTimestamp(),
        });
        return downloadUrl;
      } catch (error) {
        console.error('[affirmation-card] Failed to persist image', error);
        return sourceUrl;
      }
    },
    [affirmation.id, user]
  );

  useEffect(() => {
    if (hasPersonalImages && !personalImageOptOutRef.current) {
      setUseMyImage(true);
    }
    if (!hasPersonalImages) {
      personalImageOptOutRef.current = false;
      setUseMyImage(false);
    }
  }, [hasPersonalImages]);

  useEffect(() => {
    let isCurrent = true;
    const originalUrl = affirmation.imageUrl ?? null;

    const resolveUrl = async () => {
      if (!originalUrl) {
        if (isCurrent) setResolvedImageUrl(null);
        return;
      }

      if (originalUrl.startsWith('gs://')) {
        try {
          const path = originalUrl.replace(/^gs:\/\/[^/]+\//, '');
          const imageRef = ref(firebaseStorage, path);
          const downloadUrl = await getDownloadURL(imageRef);
          if (isCurrent) setResolvedImageUrl(downloadUrl);
        } catch (error) {
          console.error(
            '[affirmation-card] Failed to resolve image URL',
            error
          );
          if (isCurrent) setResolvedImageUrl(null);
        }
        return;
      }

      if (originalUrl.includes(FIREBASE_HOST)) {
        if (isCurrent) setResolvedImageUrl(originalUrl);
        return;
      }

      if (
        REPLICATE_HOST_PATTERNS.some((pattern) =>
          originalUrl.toLowerCase().includes(pattern)
        )
      ) {
        const migratedUrl = await persistImageFromUrl(originalUrl);
        if (isCurrent) setResolvedImageUrl(migratedUrl);
        return;
      }

      if (isCurrent) setResolvedImageUrl(originalUrl);
    };

    void resolveUrl();

    return () => {
      isCurrent = false;
    };
  }, [affirmation.imageUrl, persistImageFromUrl]);

  useEffect(() => {
    if (useMyVoice && !hasPersonalVoice) {
      setUseMyVoice(false);
    }
  }, [useMyVoice, hasPersonalVoice]);

  useEffect(() => {
    let isCancelled = false;
    const fetchVoices = async () => {
      setLoadingVoices(true);
      try {
        const response = await fetch('/api/voices');
        if (!response.ok) {
          throw new Error('Unable to load voices right now.');
        }
        const data = await response.json();
        if (isCancelled) return;
        const options =
          data.voices?.map((voice: any) => ({
            id: voice.voice_id ?? voice.id,
            name: voice.name,
            description: voice.description ?? voice.labels?.description ?? '',
          })) ?? [];
        setVoices(options);
        if (options.length > 0) {
          setSelectedVoice((current) => current || options[0].id);
        }
      } catch (error) {
        console.error('[affirmation-card] Failed to load voices', error);
        if (!isCancelled) {
          toast({
            title: 'Unable to load voices',
            description: 'We could not fetch voice options. Please try again.',
          });
        }
      } finally {
        if (!isCancelled) {
          setLoadingVoices(false);
        }
      }
    };

    fetchVoices();
    return () => {
      isCancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current && audioUrlIsObjectRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      audioUrlRef.current = null;
      audioUrlIsObjectRef.current = false;
    };
  }, [toast]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioUrlRef.current && audioUrlIsObjectRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = null;
    audioUrlIsObjectRef.current = false;
    setIsSpeaking(false);
  };

  const cacheAudioForVoice = async (voiceId: string, blob: Blob) => {
    if (!favoriteDocRef.current || !user) return null;
    try {
      const storageRef = ref(
        firebaseStorage,
        `users/${user.uid}/affirmations/${affirmation.id}/audio/${voiceId}.mp3`
      );
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      await updateDoc(favoriteDocRef.current, {
        [`audioUrls.${voiceId}`]: downloadUrl,
        updatedAt: serverTimestamp(),
      });
      setAudioUrls((prev) => ({ ...prev, [voiceId]: downloadUrl }));
      return downloadUrl;
    } catch (error) {
      console.error('[affirmation-card] Failed to cache audio', error);
      return null;
    }
  };

  const handleSpeak = async () => {
    if (audioRef.current && !audioRef.current.paused) {
      stopAudio();
      return;
    }

    if (!affirmation.affirmation) {
      toast({
        title: 'Nothing to play',
        description: 'Generate the affirmation content first.',
      });
      return;
    }

    let voiceToUse: string | null = null;
    if (useMyVoice) {
      if (!hasPersonalVoice || !profile?.voiceCloneId) {
        toast({
          title: 'Upload your reference voice',
          description:
            'Add a 30-second voice sample in account settings to enable personal playback.',
        });
        router.push('/account?setup=voice');
        setUseMyVoice(false);
        return;
      }
      voiceToUse = profile.voiceCloneId;
    } else {
      voiceToUse = selectedVoice;
    }

    if (!voiceToUse) {
      toast({
        title: 'Select a voice',
        description: 'Choose a voice before playing the affirmation.',
      });
      return;
    }

    const cachedUrl = audioUrls[voiceToUse];
    if (cachedUrl) {
      try {
        stopAudio();
        setIsSpeaking(true);
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        audioRef.current.src = cachedUrl;
        audioUrlRef.current = cachedUrl;
        audioUrlIsObjectRef.current = false;
        audioRef.current.onended = stopAudio;
        audioRef.current.onerror = stopAudio;
        await audioRef.current.play();
        return;
      } catch (error) {
        console.error('[affirmation-card] Failed to play cached audio', error);
        toast({
          title: 'Playback failed',
          description:
            error instanceof Error
              ? error.message
              : 'Something went wrong while playing the affirmation.',
          variant: 'destructive',
        });
        stopAudio();
        return;
      }
    }

    try {
      setIsSpeaking(true);
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: affirmation.affirmation,
          voiceId: voiceToUse,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to create audio using the selected voice.');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      audioUrlIsObjectRef.current = true;

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = audioUrl;
      audioRef.current.onended = stopAudio;
      audioRef.current.onerror = stopAudio;
      setIsSpeaking(true);
      await audioRef.current.play();

      void cacheAudioForVoice(voiceToUse, audioBlob);
    } catch (error) {
      console.error('[affirmation-card] Failed to speak affirmation', error);
      toast({
        title: 'Playback failed',
        description:
          error instanceof Error
            ? error.message
            : 'Something went wrong while playing the affirmation.',
        variant: 'destructive',
      });
      stopAudio();
    }
  };

  const handleGenerateImage = async () => {
    if (generating) return;

    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Log in to generate imagery for your affirmations.',
        variant: 'destructive',
      });
      return;
    }

    if (useMyImage && !hasPersonalImages) {
      toast({
        title: 'Upload your reference photos',
        description:
          'Add a close-up and full-body photo in account settings to use personal imagery.',
      });
      router.push('/account?setup=images');
      setUseMyImage(false);
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affirmation: affirmation.affirmation,
          category: affirmation.categoryTitle,
          categoryId: affirmation.categoryId,
          useUserImages: useMyImage && hasPersonalImages,
          userImages:
            useMyImage && hasPersonalImages
              ? {
                  portrait: profile?.portraitImageUrl,
                  fullBody: profile?.fullBodyImageUrl,
                }
              : undefined,
          aspectRatio: profile?.defaultAspectRatio ?? '1:1',
          demographics:
            !useMyImage || !hasPersonalImages
              ? profile?.tier === 'starter'
                ? undefined
                : demographicContext
              : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const detail =
          data?.error ??
          data?.detail ??
          (typeof data === 'string' ? data : null) ??
          'Unable to generate an image right now.';
        throw new Error(detail);
      }

      if (data.imageUrl) {
        const storedUrl = await persistImageFromUrl(data.imageUrl);
        setResolvedImageUrl(storedUrl);
        toast({
          title: 'Image generated',
          description:
            'We added a visualization for this affirmation. It may take a moment to appear.',
        });
      }
    } catch (error) {
      console.error('[affirmation-card] Failed to generate image', error);
      toast({
        title: 'Image generation failed',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a few moments.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const toggleFavorite = async () => {
    if (!favoriteDocRef.current) {
      toast({
        title: 'Sign in required',
        description: 'Log in to save affirmations to your favorites.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateDoc(favoriteDocRef.current, {
        favorite: !isFavorite,
        updatedAt: serverTimestamp(),
      });
      setIsFavorite((prev) => !prev);
      toast({
        title: !isFavorite ? 'Favorited!' : 'Removed from favorites',
        description: !isFavorite
          ? 'Affirmation saved to your favorites.'
          : 'Affirmation removed from favorites.',
      });
    } catch (error) {
      console.error('[affirmation-card] Failed to toggle favorite', error);
      toast({
        title: 'Unable to update favorite',
        description:
          error instanceof Error ? error.message : 'Please try again shortly.',
        variant: 'destructive',
      });
    }
  };

  const handleUseMyImageToggle = (checked: boolean) => {
    if (!user || !profile) {
      toast({
        title: 'Sign in required',
        description: 'Log in to use personal imagery.',
        variant: 'destructive',
      });
      return;
    }

    if (checked && !hasPersonalImages) {
      toast({
        title: 'Upload your reference photos',
        description:
          'Add a close-up and full-body photo in account settings to use personal imagery.',
      });
      router.push('/account?setup=images');
      return;
    }

    if (checked) {
      const cost = calculateCreditCost({
        usePersonalImage: true,
        useVoiceClone: useMyVoice && hasPersonalVoice,
      });
      if (!hasEnoughCredits(profile.credits, { usePersonalImage: true })) {
        toast({
          title: 'Insufficient aiams',
          description: `Personal image generation requires ${PERSONAL_IMAGE_COST} additional aiams. You need ${cost.total} total.`,
          variant: 'destructive',
        });
        router.push('/account?purchase=credits');
        return;
      }
    }

    personalImageOptOutRef.current = !checked;
    setUseMyImage(checked);
  };

  const handleUseMyVoiceToggle = (checked: boolean) => {
    if (checked) {
      if (!user || !profile) {
        toast({
          title: 'Sign in required',
          description: 'Log in to use your personal voice.',
          variant: 'destructive',
        });
        return;
      }

      if (!hasPersonalVoice || !profile?.voiceCloneId) {
        toast({
          title: 'Upload your reference voice',
          description:
            'Add a 30-second voice sample in account settings to enable personal playback.',
        });
        router.push('/account?setup=voice');
        setUseMyVoice(false);
        return;
      }

      const cost = calculateCreditCost({
        usePersonalImage: useMyImage && hasPersonalImages,
        useVoiceClone: true,
      });
      if (!hasEnoughCredits(profile.credits, { useVoiceClone: true })) {
        toast({
          title: 'Insufficient aiams',
          description: `Voice clone playback requires ${VOICE_CLONE_COST} additional aiams. You need ${cost.total} total.`,
          variant: 'destructive',
        });
        router.push('/account?purchase=credits');
        setUseMyVoice(false);
        return;
      }

      setUseMyVoice(true);
      return;
    }
    setUseMyVoice(false);
  };

  return (
    <>
      <Card className=' p-0 flex h-120 flex-col overflow-y-auto transition-shadow hover:shadow-lg'>
        {resolvedImageUrl ? (
          <button
            type='button'
            onClick={() => setImageDialogOpen(true)}
            className='relative h-72 w-full overflow-hidden'
          >
            <Image
              src={resolvedImageUrl}
              alt='Affirmation visualization'
              fill
              unoptimized
              sizes='(min-width: 768px) 50vw, 100vw'
              className='object-cover transition-transform duration-300 hover:scale-105 cursor-pointer'
            />
            <div className='pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4'>
              <Badge
                variant='default'
                style={badgeStyle}
                className='border border-transparent px-3 py-0.5 text-xs font-medium shadow'
              >
                {affirmation.categoryTitle}
              </Badge>
              {showFavoriteBadge && isFavorite && (
                <Badge className='bg-red-400/70 text-white border-transparent'>
                  Favorite
                </Badge>
              )}
            </div>
            <div className='pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6'>
              <p className='text-base font-semibold leading-relaxed text-white text-center text-md'>
                {affirmation.affirmation}
              </p>
            </div>
          </button>
        ) : (
          <CardHeader className='space-y-4 bg-muted/20 p-6'>
            <div className='flex items-center justify-between'>
              <Badge
                variant='default'
                style={badgeStyle}
                className='border border-transparent px-3 py-1 text-xs font-medium shadow-sm'
              >
                {affirmation.categoryTitle}
              </Badge>
              {showFavoriteBadge && isFavorite && (
                <Badge className='bg-red-400/70 text-white border-transparent'>
                  Favorite
                </Badge>
              )}
            </div>
            <blockquote className='rounded-2xl bg-muted/40 px-5 py-10 text-center text-md font-medium leading-relaxed text-foreground'>
              {affirmation.affirmation}
            </blockquote>
          </CardHeader>
        )}
        <CardContent className='space-y-4 p-6 text-sm flex flex-col justify-center items-center'>
          <div className='flex items-center justify-center gap-3 pt-0'>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={handleGenerateImage}
              disabled={generating}
              className='flex h-10 w-10 items-center justify-center gap-2 bg-yellow-200/60 p-0 hover:bg-yellow-300/60'
            >
              <span className='sr-only'>Generate image</span>
              {generating ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <ImageIcon className='h-4 w-4' />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                disabled={useMyVoice || loadingVoices || voices.length === 0}
              >
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  className='flex h-10 w-10 items-center justify-center gap-2 bg-purple-200/60 p-0 hover:bg-purple-300/70'
                >
                  <span className='sr-only'>Select AI voice</span>
                  <Mic className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className='w-56'>
                {voices.map((voice) => (
                  <DropdownMenuItem
                    key={voice.id}
                    onSelect={() => !useMyVoice && setSelectedVoice(voice.id)}
                    className='flex flex-col items-start gap-1'
                    disabled={useMyVoice}
                  >
                    <span className='flex w-full items-center justify-between'>
                      {voice.name}
                      {selectedVoice === voice.id && !useMyVoice && (
                        <Check className='h-4 w-4 text-primary' />
                      )}
                    </span>
                    {voice.description && (
                      <span className='text-xs text-muted-foreground'>
                        {voice.description}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={handleSpeak}
              disabled={loadingVoices || (!selectedVoice && !useMyVoice)}
              className='flex h-10 w-10 items-center justify-center gap-2 bg-blue-200/60 p-0 hover:bg-blue-400'
            >
              <span className='sr-only'>
                {isSpeaking ? 'Stop playback' : 'Play affirmation'}
              </span>
              {isSpeaking ? (
                <Square className='h-4 w-4' />
              ) : (
                <Play className='h-4 w-4' />
              )}
            </Button>
            <Button
              type='button'
              variant={isFavorite ? 'default' : 'outline'}
              size='sm'
              onClick={toggleFavorite}
              className='flex h-10 w-10 items-center justify-center gap-2 bg-red-300/70 p-0 hover:bg-red-400/80'
            >
              <span className='sr-only'>Toggle favorite</span>
              {isFavorite ? (
                <BookmarkCheck className='h-4 w-4' />
              ) : (
                <Bookmark className='h-4 w-4' />
              )}
            </Button>
          </div>

          <Collapsible
            open={personalizeOpen}
            onOpenChange={setPersonalizeOpen}
            className='rounded-2xl border border-border/40 bg-muted/10 px-3 py-0'
          >
            <div className='flex items-center justify-between'>
              <p className='text-sm font-medium text-muted-foreground'>
                Personalize your experience
              </p>
              <CollapsibleTrigger asChild>
                <Button variant='ghost' size='icon'>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      personalizeOpen ? 'rotate-180' : ''
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className='space-y-3 pt-3'>
              {showImageToggle && (
                <div className='flex items-center justify-between gap-4'>
                  <Label
                    htmlFor={`detail-toggle-my-image-${affirmation.id}`}
                    className='text-sm font-medium text-foreground'
                  >
                    Use my image
                  </Label>
                  <Switch
                    id={`detail-toggle-my-image-${affirmation.id}`}
                    checked={useMyImage}
                    onCheckedChange={handleUseMyImageToggle}
                  />
                </div>
              )}
              <div className='flex items-center justify-between gap-4'>
                <Label
                  htmlFor={`detail-toggle-my-voice-${affirmation.id}`}
                  className='text-sm font-medium text-foreground'
                >
                  Use my voice
                </Label>
                <Switch
                  id={`detail-toggle-my-voice-${affirmation.id}`}
                  checked={useMyVoice}
                  onCheckedChange={handleUseMyVoiceToggle}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      {resolvedImageUrl && (
        <AffirmationImageDialog
          open={imageDialogOpen}
          onOpenChange={setImageDialogOpen}
          imageUrl={resolvedImageUrl}
          affirmation={affirmation.affirmation}
        />
      )}
    </>
  );
}
