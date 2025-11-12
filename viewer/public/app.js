// Configuration - will be replaced during deployment
const API_ENDPOINT = 'API_GATEWAY_URL_PLACEHOLDER';

let allJobs = [];

// Load jobs on page load
document.addEventListener('DOMContentLoaded', () => {
    loadJobs();
});

/**
 * Load all jobs from the API
 */
async function loadJobs() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const jobsGrid = document.getElementById('jobsGrid');
    const emptyState = document.getElementById('emptyState');
    const stats = document.getElementById('stats');

    // Show loading
    loading.style.display = 'block';
    error.style.display = 'none';
    jobsGrid.innerHTML = '';
    emptyState.style.display = 'none';
    stats.style.display = 'none';

    try {
        const response = await fetch(`${API_ENDPOINT}/jobs`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        allJobs = data.jobs || [];

        loading.style.display = 'none';

        if (allJobs.length === 0) {
            emptyState.style.display = 'block';
        } else {
            updateStats();
            renderJobs(allJobs);
            stats.style.display = 'flex';
        }

    } catch (err) {
        console.error('Error loading jobs:', err);
        loading.style.display = 'none';
        error.style.display = 'block';
        error.textContent = `Error loading jobs: ${err.message}. Please check your API endpoint configuration.`;
    }
}

/**
 * Update statistics
 */
function updateStats() {
    const completed = allJobs.filter(j => j.status === 'completed' || j.status === 'completed_with_errors').length;
    const processing = allJobs.filter(j => j.status === 'processing' || j.status === 'pending').length;
    const failed = allJobs.filter(j => j.status === 'failed').length;

    document.getElementById('totalJobs').textContent = allJobs.length;
    document.getElementById('completedJobs').textContent = completed;
    document.getElementById('processingJobs').textContent = processing;
    document.getElementById('failedJobs').textContent = failed;
}

/**
 * Filter jobs based on search and status
 */
function filterJobs() {
    const searchText = document.getElementById('filterInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    let filtered = allJobs;

    // Apply text filter
    if (searchText) {
        filtered = filtered.filter(job => {
            return (
                job.job_id.toLowerCase().includes(searchText) ||
                (job.prompt && job.prompt.toLowerCase().includes(searchText)) ||
                (job.customer_id && job.customer_id.toLowerCase().includes(searchText))
            );
        });
    }

    // Apply status filter
    if (statusFilter) {
        filtered = filtered.filter(job => {
            if (statusFilter === 'completed') {
                return job.status === 'completed' || job.status === 'completed_with_errors';
            }
            return job.status === statusFilter;
        });
    }

    renderJobs(filtered);
}

/**
 * Render jobs to the grid
 */
function renderJobs(jobs) {
    const jobsGrid = document.getElementById('jobsGrid');
    const emptyState = document.getElementById('emptyState');

    if (jobs.length === 0) {
        jobsGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    jobsGrid.innerHTML = jobs.map(job => {
        const statusClass = job.status.includes('completed') ? 'status-completed' :
                           job.status === 'failed' ? 'status-failed' : 'status-processing';
        const statusText = job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ');
        const imageUrl = job.output_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';

        const createdDate = job.created_at ? new Date(job.created_at).toLocaleString() : 'N/A';
        const aspectRatio = job.aspect_ratio || 'N/A';

        return `
            <div class="job-card">
                <img src="${imageUrl}" alt="Generated image" class="job-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 400 300&quot;%3E%3Crect fill=&quot;%23f0f0f0&quot; width=&quot;400&quot; height=&quot;300&quot;/%3E%3Ctext x=&quot;50%25&quot; y=&quot;50%25&quot; dominant-baseline=&quot;middle&quot; text-anchor=&quot;middle&quot; font-family=&quot;sans-serif&quot; font-size=&quot;24&quot; fill=&quot;%23999&quot;%3EImage Not Available%3C/text%3E%3C/svg%3E'">
                <div class="job-content">
                    <div class="job-header">
                        <div class="job-id">${job.job_id.substring(0, 12)}...</div>
                        <div class="status-badge ${statusClass}">${statusText}</div>
                    </div>

                    ${job.prompt ? `<div class="job-prompt">${escapeHtml(job.prompt)}</div>` : ''}

                    <div class="job-meta">
                        <div class="meta-item">
                            <span class="meta-label">Created</span>
                            <span class="meta-value">${createdDate}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Aspect Ratio</span>
                            <span class="meta-value">${aspectRatio}</span>
                        </div>
                        ${job.customer_id ? `
                        <div class="meta-item">
                            <span class="meta-label">Customer</span>
                            <span class="meta-value">${escapeHtml(job.customer_id)}</span>
                        </div>
                        ` : ''}
                        ${job.duration_ms ? `
                        <div class="meta-item">
                            <span class="meta-label">Duration</span>
                            <span class="meta-value">${(job.duration_ms / 1000).toFixed(2)}s</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="job-actions">
                        <button class="btn btn-primary" onclick='viewDetails("${job.job_id}")'>
                            View Details
                        </button>
                        ${job.output_url ? `
                        <a href="${job.output_url}" download class="btn btn-secondary" style="text-decoration: none;">
                            Download
                        </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * View job details in modal
 */
async function viewDetails(jobId) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modalBody');

    // Show loading in modal
    modalBody.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div><p>Loading details...</p></div>';
    modal.classList.add('active');

    try {
        const response = await fetch(`${API_ENDPOINT}/jobs/${jobId}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const job = data.job;
        const images = data.images;

        // Find first completed image for display
        const completedImage = images.find(img => img.status === 'completed');
        const imageHtml = completedImage && completedImage.s3_url
            ? `<img src="${completedImage.s3_url}" alt="Generated image" class="modal-image">`
            : '<p style="text-align: center; padding: 40px; background: #f7fafc; border-radius: 8px;">No image available</p>';

        modalBody.innerHTML = `
            ${imageHtml}
            <h2 style="margin-bottom: 20px; color: #2d3748;">Job Details</h2>
            <div class="modal-details">
                <div class="detail-row">
                    <div class="detail-label">Job ID:</div>
                    <div class="detail-value">${job.job_id}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">${job.status}</div>
                </div>
                ${job.prompt ? `
                <div class="detail-row">
                    <div class="detail-label">Prompt:</div>
                    <div class="detail-value">${escapeHtml(job.prompt)}</div>
                </div>
                ` : ''}
                ${completedImage?.prompt_metadata?.enhanced_prompt ? `
                <div class="detail-row">
                    <div class="detail-label">Enhanced Prompt:</div>
                    <div class="detail-value">${escapeHtml(completedImage.prompt_metadata.enhanced_prompt)}</div>
                </div>
                ` : ''}
                ${job.customer_id ? `
                <div class="detail-row">
                    <div class="detail-label">Customer ID:</div>
                    <div class="detail-value">${escapeHtml(job.customer_id)}</div>
                </div>
                ` : ''}
                <div class="detail-row">
                    <div class="detail-label">Aspect Ratio:</div>
                    <div class="detail-value">${job.aspect_ratio || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Created At:</div>
                    <div class="detail-value">${job.created_at ? new Date(job.created_at).toLocaleString() : 'N/A'}</div>
                </div>
                ${job.completed_at ? `
                <div class="detail-row">
                    <div class="detail-label">Completed At:</div>
                    <div class="detail-value">${new Date(job.completed_at).toLocaleString()}</div>
                </div>
                ` : ''}
                ${completedImage?.generation_time ? `
                <div class="detail-row">
                    <div class="detail-label">Generation Time:</div>
                    <div class="detail-value">${(completedImage.generation_time / 1000).toFixed(2)} seconds</div>
                </div>
                ` : ''}
                ${completedImage?.s3_key ? `
                <div class="detail-row">
                    <div class="detail-label">S3 Key:</div>
                    <div class="detail-value" style="word-break: break-all;">${completedImage.s3_key}</div>
                </div>
                ` : ''}
                <div class="detail-row">
                    <div class="detail-label">Images Generated:</div>
                    <div class="detail-value">${images.length} image(s)</div>
                </div>
                ${job.progress ? `
                <div class="detail-row">
                    <div class="detail-label">Progress:</div>
                    <div class="detail-value">${job.progress.completed || 0} completed, ${job.progress.failed || 0} failed out of ${job.progress.total || 0} total</div>
                </div>
                ` : ''}
            </div>
            ${completedImage && completedImage.s3_url ? `
            <div style="margin-top: 20px; text-align: center;">
                <a href="${completedImage.s3_url}" download class="btn btn-primary">Download Full Resolution</a>
            </div>
            ` : ''}
        `;

    } catch (error) {
        console.error('Error loading job details:', error);
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #fed7d7; border-radius: 8px; color: #c53030;">
                <h3>Error Loading Details</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

/**
 * Close modal
 */
function closeModal(event) {
    if (!event || event.target.id === 'modal') {
        document.getElementById('modal').classList.remove('active');
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});
