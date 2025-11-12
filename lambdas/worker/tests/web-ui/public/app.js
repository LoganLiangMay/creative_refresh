/**
 * RDA Image Generator - Web UI Client
 */

let uploadedFiles = [];

// DOM Elements
const form = document.getElementById('generateForm');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('inputImages');
const imagePreview = document.getElementById('imagePreview');
const generateBtn = document.getElementById('generateBtn');
const progress = document.getElementById('progress');
const progressDetails = document.getElementById('progressDetails');
const noResults = document.getElementById('noResults');
const results = document.getElementById('results');
const clearDataBtn = document.getElementById('clearDataBtn');
const errorToast = document.getElementById('errorToast');
const errorMessage = document.getElementById('errorMessage');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop();
    setupFormHandlers();
});

/**
 * Setup drag and drop functionality
 */
function setupDragAndDrop() {
    // Click to browse
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
}

/**
 * Setup form event handlers
 */
function setupFormHandlers() {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateImage();
    });

    clearDataBtn.addEventListener('click', async () => {
        if (confirm('Clear all test data? This cannot be undone.')) {
            await clearTestData();
        }
    });
}

/**
 * Handle uploaded files
 */
function handleFiles(files) {
    uploadedFiles = Array.from(files);

    // Clear preview
    imagePreview.innerHTML = '';

    if (uploadedFiles.length === 0) {
        return;
    }

    // Show preview for each file
    uploadedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="${file.name}">
                <div class="preview-item-info">
                    <div class="preview-item-name">${file.name}</div>
                    <div class="preview-item-size">${(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <button type="button" class="preview-item-remove" data-index="${index}">×</button>
            `;

            // Remove button handler
            previewItem.querySelector('.preview-item-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFile(index);
            });

            imagePreview.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Remove a file from the upload list
 */
function removeFile(index) {
    uploadedFiles.splice(index, 1);
    handleFiles(uploadedFiles);
}

/**
 * Generate image
 */
async function generateImage() {
    const formData = new FormData();

    // Add form fields
    formData.append('prompt', document.getElementById('prompt').value);
    formData.append('aspectRatio', document.getElementById('aspectRatio').value);
    formData.append('mockMode', document.getElementById('mockMode').checked);

    // Add uploaded files
    uploadedFiles.forEach(file => {
        formData.append('inputImages', file);
    });

    // Show progress
    showProgress();

    try {
        updateProgress('Sending request...');

        const response = await fetch('/api/generate', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Generation failed');
        }

        updateProgress('Complete!');
        setTimeout(() => {
            hideProgress();
            displayResults(data);
        }, 500);

    } catch (error) {
        console.error('Generation error:', error);
        hideProgress();
        showError(error.message);
    }
}

/**
 * Display generation results
 */
function displayResults(data) {
    noResults.classList.add('hidden');
    results.classList.remove('hidden');

    // Metadata
    document.getElementById('resultMode').textContent = data.mode === 'mock' ? '🎭 Mock' : '💰 Real';
    document.getElementById('resultDuration').textContent = `${(data.duration / 1000).toFixed(2)}s`;
    document.getElementById('resultCost').textContent = data.cost === 0 ? 'Free' : `$${data.cost.toFixed(3)}`;

    // Enhanced prompt
    if (data.metadata && data.metadata.enhanced_prompt) {
        const enhancedPromptSection = document.getElementById('enhancedPromptSection');
        const enhancedPrompt = document.getElementById('enhancedPrompt');
        enhancedPromptSection.classList.remove('hidden');
        enhancedPrompt.textContent = data.metadata.enhanced_prompt;
    }

    // Input images
    if (data.inputImages && data.inputImages.length > 0) {
        const inputImagesDisplay = document.getElementById('inputImagesDisplay');
        const inputImagesList = document.getElementById('inputImagesList');
        inputImagesDisplay.classList.remove('hidden');
        inputImagesList.innerHTML = '';

        data.inputImages.forEach(img => {
            const imgItem = document.createElement('div');
            imgItem.className = 'input-image-item';
            imgItem.innerHTML = `
                <div class="input-image-name">${img.name}</div>
                <div class="input-image-size">${(img.size / 1024).toFixed(1)} KB</div>
            `;
            inputImagesList.appendChild(imgItem);
        });
    } else {
        document.getElementById('inputImagesDisplay').classList.add('hidden');
    }

    // Generated image
    if (data.outputPath) {
        const generatedImage = document.getElementById('generatedImage');
        generatedImage.src = data.outputPath + '?t=' + Date.now(); // Cache bust

        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.classList.remove('hidden');
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.href = data.outputPath;
            link.download = `${data.imageId}.jpg`;
            link.click();
        };
    }
}

/**
 * Show progress indicator
 */
function showProgress() {
    generateBtn.disabled = true;
    progress.classList.remove('hidden');
    results.classList.add('hidden');
}

/**
 * Update progress text
 */
function updateProgress(text) {
    progressDetails.textContent = text;
}

/**
 * Hide progress indicator
 */
function hideProgress() {
    generateBtn.disabled = false;
    progress.classList.add('hidden');
}

/**
 * Show error toast
 */
function showError(message) {
    errorMessage.textContent = message;
    errorToast.classList.remove('hidden');

    setTimeout(() => {
        errorToast.classList.add('hidden');
    }, 5000);
}

/**
 * Clear all test data
 */
async function clearTestData() {
    try {
        const response = await fetch('/api/results', {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            // Reset UI
            results.classList.add('hidden');
            noResults.classList.remove('hidden');
            uploadedFiles = [];
            imagePreview.innerHTML = '';
            form.reset();
        } else {
            showError('Failed to clear data');
        }
    } catch (error) {
        showError(error.message);
    }
}
