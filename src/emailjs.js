import emailjs from '@emailjs/browser';
import { emailjsConfig } from './config.js';

export const sendEmail = async (formData) => {
    try {
        console.log("Attempting to send email via EmailJS:", formData);

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

        console.log("Email sent successfully:", result);
        return { success: true, result };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error: error.message };
    }
};