// Evolution API Integration for FrigoGest
// Envia mensagens WhatsApp automaticamente

const EVOLUTION_API_URL = import.meta.env.VITE_EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = import.meta.env.VITE_EVOLUTION_INSTANCE || '';

export interface WhatsAppMessage {
    phone: string;
    message: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'document';
}

export interface WhatsAppResponse {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Envia mensagem de texto via Evolution API
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<WhatsAppResponse> {
    // Se não tiver API configurada, usa o método manual (WhatsApp Web)
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        console.warn('⚠️ Evolution API não configurada. Usando método manual.');
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
        return { success: false, error: 'API não configurada - enviado via WhatsApp Web' };
    }

    try {
        const cleanPhone = phone.replace(/\D/g, '');
        const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: formattedPhone,
                text: message
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        console.log('✅ WhatsApp enviado:', data);

        return {
            success: true,
            messageId: data.key?.id || 'unknown'
        };
    } catch (error) {
        console.error('❌ Erro ao enviar WhatsApp:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
}

/**
 * Envia mensagem com mídia (imagem, vídeo, documento)
 */
export async function sendWhatsAppMedia(data: WhatsAppMessage): Promise<WhatsAppResponse> {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        console.warn('⚠️ Evolution API não configurada.');
        return { success: false, error: 'API não configurada' };
    }

    if (!data.mediaUrl) {
        return sendWhatsAppMessage(data.phone, data.message);
    }

    try {
        const cleanPhone = data.phone.replace(/\D/g, '');
        const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

        const endpoint = data.mediaType === 'image' ? 'sendMedia' :
            data.mediaType === 'video' ? 'sendMedia' :
                'sendMedia';

        const response = await fetch(`${EVOLUTION_API_URL}/message/${endpoint}/${EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: formattedPhone,
                mediatype: data.mediaType || 'image',
                media: data.mediaUrl,
                caption: data.message
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ WhatsApp mídia enviada:', result);

        return {
            success: true,
            messageId: result.key?.id || 'unknown'
        };
    } catch (error) {
        console.error('❌ Erro ao enviar mídia WhatsApp:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
}

/**
 * Verifica se a API está configurada e funcionando
 */
export async function checkWhatsAppAPIStatus(): Promise<boolean> {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        return false;
    }

    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });

        if (!response.ok) return false;

        const data = await response.json();
        return data.state === 'open';
    } catch {
        return false;
    }
}

/**
 * Envia mensagens em lote com delay entre cada uma
 */
export async function sendBulkMessages(
    messages: Array<{ phone: string; message: string }>,
    delayMs: number = 3000
): Promise<WhatsAppResponse[]> {
    const results: WhatsAppResponse[] = [];

    for (const msg of messages) {
        const result = await sendWhatsAppMessage(msg.phone, msg.message);
        results.push(result);

        // Aguardar antes de enviar a próxima (evita ban do WhatsApp)
        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return results;
}
