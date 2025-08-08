import emailjs from '@emailjs/browser';
import { emailjsConfig, formConfig } from './config.js';

export const sendEmail = async (formData) => {
    try {
        // Initialize EmailJS (safe to call multiple times)
        if (emailjs.init && emailjsConfig.publicKey) {
            emailjs.init(emailjsConfig.publicKey);
        }

        const templateParams = {
            to_email: 'owenkobasz@gmail.com',
            from_name: formData.name,
            from_email: formData.email,
            message: formData.message,
            reply_to: formData.email
        };

        const result = await emailjs.send(
            emailjsConfig.serviceId,
            emailjsConfig.templateId,
            templateParams,
            emailjsConfig.publicKey
        );

        return { success: true, provider: 'emailjs', result };
    } catch (error) {
        // Optional fallback to Formspree if configured
        if (formConfig.formspreeFormId) {
            try {
                const resp = await fetch(`https://formspree.io/f/${formConfig.formspreeFormId}`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        message: formData.message
                    })
                });
                if (resp.ok) {
                    const data = await resp.json().catch(() => ({}));
                    return { success: true, provider: 'formspree', result: data };
                } else {
                    const data = await resp.json().catch(() => ({}));
                    return { success: false, provider: 'formspree', error: data || { status: resp.status } };
                }
            } catch (fallbackErr) {
                return { success: false, provider: 'formspree', error: fallbackErr?.message || fallbackErr };
            }
        }
        return { success: false, provider: 'emailjs', error: error?.message || error };
    }
};