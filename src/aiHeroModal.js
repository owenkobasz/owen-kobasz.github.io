/**
 * AI Hero Image Modal Component
 * Handles the modal UI, form submission, and hero image replacement
 */

const STORAGE_KEY = 'aiHeroImage';

class AIHeroModal {
    constructor() {
        this.modal = null;
        this.isOpen = false;
        this.isGenerating = false;
        this.defaultHeroSrc = null;
        this.init();
    }

    init() {
        this.createModal();
        this.attachEventListeners();
        
        // Store default hero src after page loads (to get webpack-processed path)
        // This will be called after index.js sets the image src
        const captureDefaultSrc = () => {
            const heroImage = document.querySelector('.hero-image');
            if (heroImage && !this.defaultHeroSrc) {
                // Only capture if it's not an AI-generated image
                const savedImage = localStorage.getItem(STORAGE_KEY);
                if (!savedImage || !heroImage.src.includes('data:image')) {
                    this.defaultHeroSrc = heroImage.src;
                }
            }
        };
        
        // Try immediately, then after load, then with a small delay
        captureDefaultSrc();
        if (document.readyState === 'loading') {
            window.addEventListener('load', captureDefaultSrc, { once: true });
        }
        setTimeout(captureDefaultSrc, 500);
        
        this.loadSavedImage();
        this.updateResetButtonVisibility();
        
        // Listen for storage changes (in case of multiple tabs)
        window.addEventListener('storage', () => {
            this.loadSavedImage();
            this.updateResetButtonVisibility();
        });
    }

    createModal() {
        const modalHTML = `
            <div class="ai-hero-modal" id="ai-hero-modal" role="dialog" aria-labelledby="ai-hero-modal-title" aria-hidden="true">
                <div class="ai-hero-modal__overlay"></div>
                <div class="ai-hero-modal__content">
                    <button class="ai-hero-modal__close" aria-label="Close modal">&times;</button>
                    <h2 class="ai-hero-modal__title" id="ai-hero-modal-title">Generate Hero Image</h2>
                    <form class="ai-hero-modal__form" id="ai-hero-form">
                        <div class="ai-hero-modal__field">
                            <label for="ai-hero-prompt" class="ai-hero-modal__label">Describe the hero image...</label>
                            <textarea 
                                id="ai-hero-prompt" 
                                name="prompt" 
                                class="ai-hero-modal__textarea" 
                                rows="4" 
                                placeholder="e.g., A serene landscape with mountains at sunset (optional if uploading an image)"
                                minlength="10"
                                maxlength="500"
                            ></textarea>
                            <div class="ai-hero-modal__char-count">
                                <span id="char-count">0</span> / 500
                            </div>
                            <div class="ai-hero-modal__error" id="prompt-error"></div>
                        </div>
                        <div class="ai-hero-modal__field">
                            <label for="ai-hero-image-upload" class="ai-hero-modal__label">
                                Or upload a reference image (optional)
                            </label>
                            <input 
                                type="file" 
                                id="ai-hero-image-upload" 
                                name="image" 
                                accept="image/*"
                                class="ai-hero-modal__file-input"
                            />
                            <div class="ai-hero-modal__image-preview" id="image-preview" style="display: none;">
                                <img id="preview-image" alt="Preview" />
                                <button type="button" class="ai-hero-modal__remove-image" id="remove-image">Remove</button>
                            </div>
                            <div class="ai-hero-modal__help-text">
                                Upload an image to transform it into the neoclassical poster style
                            </div>
                        </div>
                        <div class="ai-hero-modal__error ai-hero-modal__error--general" id="general-error"></div>
                        <div class="ai-hero-modal__actions">
                            <button type="button" class="ai-hero-modal__button ai-hero-modal__button--cancel" id="ai-hero-cancel">Cancel</button>
                            <button type="submit" class="ai-hero-modal__button ai-hero-modal__button--generate" id="ai-hero-generate">
                                <span class="ai-hero-modal__button-text">Generate</span>
                                <span class="ai-hero-modal__spinner" style="display: none;"></span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('ai-hero-modal');
    }

    attachEventListeners() {
        // Open modal button
        const openButton = document.getElementById('ai-hero-open-btn');
        if (openButton) {
            openButton.addEventListener('click', () => this.open());
        }

        // Close button
        const closeButton = this.modal.querySelector('.ai-hero-modal__close');
        closeButton.addEventListener('click', () => this.close());

        // Overlay click
        const overlay = this.modal.querySelector('.ai-hero-modal__overlay');
        overlay.addEventListener('click', () => this.close());

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Form submission
        const form = document.getElementById('ai-hero-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Character count
        const textarea = document.getElementById('ai-hero-prompt');
        const charCount = document.getElementById('char-count');
        textarea.addEventListener('input', () => {
            charCount.textContent = textarea.value.length;
        });

        // Image upload handling
        const fileInput = document.getElementById('ai-hero-image-upload');
        const imagePreview = document.getElementById('image-preview');
        const previewImage = document.getElementById('preview-image');
        const removeImageBtn = document.getElementById('remove-image');
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    this.showError('general-error', 'Please select a valid image file');
                    fileInput.value = '';
                    return;
                }
                
                // Validate file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    this.showError('general-error', 'Image file must be less than 10MB');
                    fileInput.value = '';
                    return;
                }
                
                // Show preview
                const reader = new FileReader();
                reader.onload = (event) => {
                    previewImage.src = event.target.result;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
        
        removeImageBtn.addEventListener('click', () => {
            fileInput.value = '';
            imagePreview.style.display = 'none';
            previewImage.src = '';
        });

        // Reset button
        const resetButton = document.getElementById('ai-hero-reset-btn');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetToDefault());
        }
    }

    open() {
        if (this.isGenerating) return;
        this.modal.classList.add('ai-hero-modal--open');
        this.modal.setAttribute('aria-hidden', 'false');
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
        
        // Focus textarea
        setTimeout(() => {
            document.getElementById('ai-hero-prompt').focus();
        }, 100);
    }

    close() {
        if (this.isGenerating) return;
        this.modal.classList.remove('ai-hero-modal--open');
        this.modal.setAttribute('aria-hidden', 'true');
        this.isOpen = false;
        document.body.style.overflow = '';
        this.clearErrors();
    }

    clearErrors() {
        document.getElementById('prompt-error').textContent = '';
        document.getElementById('general-error').textContent = '';
        document.getElementById('ai-hero-prompt').classList.remove('ai-hero-modal__textarea--error');
    }

    showError(elementId, message) {
        const errorEl = document.getElementById(elementId);
        errorEl.textContent = message;
        if (elementId === 'prompt-error') {
            document.getElementById('ai-hero-prompt').classList.add('ai-hero-modal__textarea--error');
        }
    }

    async handleSubmit() {
        if (this.isGenerating) return;

        const prompt = document.getElementById('ai-hero-prompt').value.trim();
        const fileInput = document.getElementById('ai-hero-image-upload');
        const file = fileInput.files[0];

        // Validation
        this.clearErrors();
        
        // Must have either prompt or image
        if (!prompt && !file) {
            this.showError('prompt-error', 'Please enter a description or upload an image');
            return;
        }
        
        // If prompt is provided, validate it
        if (prompt) {
            if (prompt.length < 10) {
                this.showError('prompt-error', 'Description must be at least 10 characters');
                return;
            }
            
            if (prompt.length > 500) {
                this.showError('prompt-error', 'Description must be 500 characters or less');
                return;
            }
        }
        
        // Convert image to base64 if provided
        let imageBase64 = null;
        if (file) {
            try {
                imageBase64 = await this.fileToBase64(file);
            } catch (error) {
                this.showError('general-error', 'Failed to process image. Please try again.');
                return;
            }
        }

        // Set generating state
        this.isGenerating = true;
        const generateButton = document.getElementById('ai-hero-generate');
        const buttonText = generateButton.querySelector('.ai-hero-modal__button-text');
        const spinner = generateButton.querySelector('.ai-hero-modal__spinner');
        
        buttonText.style.display = 'none';
        spinner.style.display = 'inline-block';
        generateButton.disabled = true;
        document.getElementById('ai-hero-prompt').disabled = true;
        document.getElementById('ai-hero-image-upload').disabled = true;
        document.getElementById('ai-hero-cancel').disabled = true;

        try {
            const requestBody = { prompt: prompt || undefined };
            if (imageBase64) {
                requestBody.image = imageBase64;
            }
            
            const response = await fetch('/api/hero-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const data = await response.json();
            const imageDataUrl = data.imageDataUrl || data.imageUrl;

            if (!imageDataUrl) {
                throw new Error('No image data received from server');
            }

            // Replace hero image
            this.replaceHeroImage(imageDataUrl);

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, imageDataUrl);

            // Close modal
            this.close();
            this.clearForm();

        } catch (error) {
            console.error('Error generating image:', error);
            let errorMessage = 'Failed to generate image. Please try again.';
            
            if (error.message.includes('rate limit')) {
                errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            this.showError('general-error', errorMessage);
        } finally {
            // Reset generating state
            this.isGenerating = false;
            buttonText.style.display = 'inline';
            spinner.style.display = 'none';
            generateButton.disabled = false;
            document.getElementById('ai-hero-prompt').disabled = false;
            document.getElementById('ai-hero-image-upload').disabled = false;
            document.getElementById('ai-hero-cancel').disabled = false;
        }
    }

    replaceHeroImage(imageSrc) {
        const heroImage = document.querySelector('.hero-image');
        if (heroImage) {
            // Store original src if not already stored
            if (!heroImage.dataset.originalSrc) {
                heroImage.dataset.originalSrc = heroImage.src;
            }
            heroImage.src = imageSrc;
        }
        this.updateResetButtonVisibility();
    }

    loadSavedImage() {
        const savedImage = localStorage.getItem(STORAGE_KEY);
        if (savedImage) {
            // Verify it's a valid data URL or URL
            if (savedImage.startsWith('data:image/') || savedImage.startsWith('http')) {
                this.replaceHeroImage(savedImage);
            } else {
                // Invalid data, clear it
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }

    resetToDefault() {
        const heroImage = document.querySelector('.hero-image');
        if (heroImage) {
            // Use stored original src, or fall back to current defaultHeroSrc
            const originalSrc = heroImage.dataset.originalSrc || this.defaultHeroSrc || heroImage.src;
            heroImage.src = originalSrc;
            heroImage.removeAttribute('data-original-src');
        }
        localStorage.removeItem(STORAGE_KEY);
        this.updateResetButtonVisibility();
    }

    updateResetButtonVisibility() {
        const resetButton = document.getElementById('ai-hero-reset-btn');
        const hasCustomImage = localStorage.getItem(STORAGE_KEY);
        if (resetButton) {
            if (hasCustomImage) {
                resetButton.classList.add('ai-hero-reset-btn--visible');
            } else {
                resetButton.classList.remove('ai-hero-reset-btn--visible');
            }
        }
    }

    clearForm() {
        document.getElementById('ai-hero-form').reset();
        document.getElementById('char-count').textContent = '0';
        document.getElementById('image-preview').style.display = 'none';
        document.getElementById('preview-image').src = '';
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove data URL prefix (data:image/...;base64,)
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

export default AIHeroModal;

