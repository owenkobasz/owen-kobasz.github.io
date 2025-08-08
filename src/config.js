
// EmailJS configuration
// You'll need to get these from your EmailJS dashboard
export const emailjsConfig = {
    serviceId: "service_p0gwcua", // Replace with your EmailJS service ID
    templateId: "template_amgeyhw", // Replace with your EmailJS template ID
    publicKey: "3NqOgq0BNUofoLc3X" // Your EmailJS public key
};

// Optional: Formspree fallback. If you set a form ID, the app will
// fall back to Formspree when EmailJS fails (e.g., adblock or CORS).
export const formConfig = {
    formspreeFormId: "" // e.g. "xyzabcd" for https://formspree.io/f/xyzabcd
};