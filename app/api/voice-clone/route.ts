import { NextResponse } from 'next/server';

const ELEVENLABS_CLONE_ENDPOINT = 'https://api.elevenlabs.io/v1/voices/add';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key is not configured.' },
        { status: 500 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Form data with audio file is required.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const name = (formData.get('name') as string | null) ?? 'AiAm Voice Clone';

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'A valid audio file is required.' },
        { status: 400 }
      );
    }

    const cloneForm = new FormData();
    cloneForm.append('name', name);
    cloneForm.append('files', file, 'voice-reference.webm');

    const response = await fetch(ELEVENLABS_CLONE_ENDPOINT, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: cloneForm,
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: 'Failed to clone voice with ElevenLabs.', detail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      voiceId: data?.voice_id ?? data?.voiceId,
      voiceName: data?.name ?? name,
    });
  } catch (error) {
    console.error('[api/voice-clone] Error creating voice clone:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create voice clone.',
      },
      { status: 500 }
    );
  }
}
