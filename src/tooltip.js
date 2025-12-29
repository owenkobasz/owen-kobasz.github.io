/**
 * Popover-style tooltip for Skills grid
 * Lightweight, accessible, and canvas-friendly
 */

// Configuration
const CONFIG = {
    hoverDelay: 150,      // ms delay before showing on hover
    closeDelay: 100,      // ms delay before closing
    offset: 10,           // px offset from tile
    maxWidth: 260,        // max width of tooltip
    touchBreakpoint: 1024 // px - treat as touch device below this (includes tablets)
};

// State
let tooltipElement = null;
let currentTarget = null;
let showTimeout = null;
let hideTimeout = null;
let isTouchDevice = false;
let isTooltipOpen = false;

/**
 * Initialize tooltip system
 */
export function initSkillTooltips() {
    // Detect touch device
    isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Create tooltip element
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'skill-tooltip';
    tooltipElement.setAttribute('role', 'tooltip');
    tooltipElement.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltipElement);
    
    // Find all skill tiles
    const skillTiles = document.querySelectorAll('.skills__item');
    
    if (skillTiles.length === 0) {
        console.warn('No skill tiles found');
        return;
    }
    
    // Convert tiles to buttons if needed and ensure accessibility
    skillTiles.forEach((tile) => {
        // Ensure tile is focusable
        if (tile.tagName !== 'BUTTON') {
            // Convert to button or add tabindex
            const button = document.createElement('button');
            button.className = tile.className;
            button.setAttribute('type', 'button');
            button.setAttribute('aria-label', tile.querySelector('.skills__item-name')?.textContent || 'Skill');
            
            // Copy data attribute if exists
            if (tile.hasAttribute('data-skill-info')) {
                button.setAttribute('data-skill-info', tile.getAttribute('data-skill-info'));
            }
            
            // Move children
            while (tile.firstChild) {
                button.appendChild(tile.firstChild);
            }
            
            // Replace tile with button
            tile.parentNode.replaceChild(button, tile);
        } else {
            // Already a button - ensure it has aria-label for accessibility
            if (!tile.hasAttribute('aria-label')) {
                const label = tile.querySelector('.skills__item-name')?.textContent || 'Skill';
                tile.setAttribute('aria-label', label);
            }
        }
    });
    
    // Re-query after conversion (or use existing buttons)
    const skillButtons = document.querySelectorAll('.skills__item[data-skill-info]');
    
    skillButtons.forEach((button) => {
        attachTooltipListeners(button);
    });
    
    // Global listeners for closing
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    
    // Click outside to close (for touch devices and tablets)
    const isTabletOrTouch = isTouchDevice || window.innerWidth < CONFIG.touchBreakpoint;
    if (isTabletOrTouch) {
        document.addEventListener('click', handleClickOutside);
    }
}

/**
 * Attach tooltip event listeners to a skill tile
 */
function attachTooltipListeners(tile) {
    const tooltipText = tile.getAttribute('data-skill-info');
    
    if (!tooltipText) {
        return;
    }
    
    // Mouse events
    tile.addEventListener('mouseenter', () => handleShow(tile, tooltipText));
    tile.addEventListener('mouseleave', handleMouseLeave);
    
    // Focus events
    tile.addEventListener('focusin', () => handleShow(tile, tooltipText));
    tile.addEventListener('focusout', handleFocusOut);
    
    // Touch/click events (toggle on touch devices and tablets)
    // Always add click handler for tablets/tablets - they need toggle behavior
    const isTabletOrTouch = isTouchDevice || window.innerWidth < CONFIG.touchBreakpoint;
    if (isTabletOrTouch) {
        tile.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleToggle(tile, tooltipText);
        });
    }
    
    // Pointer events for tooltip hover (to prevent flicker)
    tooltipElement.addEventListener('pointerenter', () => {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    });
    
    tooltipElement.addEventListener('pointerleave', () => {
        if (currentTarget && !isTouchDevice) {
            scheduleHide();
        }
    });
}

/**
 * Show tooltip
 */
function handleShow(tile, text) {
    // Clear any pending hide
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
    
    // If already showing for this tile, do nothing
    if (currentTarget === tile && isTooltipOpen) {
        return;
    }
    
    // Clear any pending show
    if (showTimeout) {
        clearTimeout(showTimeout);
    }
    
    // Schedule show
    showTimeout = setTimeout(() => {
        showTooltip(tile, text);
        showTimeout = null;
    }, CONFIG.hoverDelay);
}

/**
 * Show tooltip immediately
 */
function showTooltip(tile, text) {
    currentTarget = tile;
    isTooltipOpen = true;
    
    tooltipElement.textContent = text;
    tooltipElement.setAttribute('aria-hidden', 'false');
    
    // Position tooltip
    positionTooltip(tile);
    
    // Show with animation
    tooltipElement.classList.add('skill-tooltip--visible');
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    if (!isTooltipOpen) {
        return;
    }
    
    isTooltipOpen = false;
    currentTarget = null;
    
    tooltipElement.classList.remove('skill-tooltip--visible');
    tooltipElement.setAttribute('aria-hidden', 'true');
    
    // Clear timeouts
    if (showTimeout) {
        clearTimeout(showTimeout);
        showTimeout = null;
    }
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
}

/**
 * Schedule hide with delay
 */
function scheduleHide() {
    if (hideTimeout) {
        return;
    }
    
    hideTimeout = setTimeout(() => {
        hideTooltip();
        hideTimeout = null;
    }, CONFIG.closeDelay);
}

/**
 * Handle mouse leave
 */
function handleMouseLeave() {
    // Don't hide immediately - check if pointer moved to tooltip
    scheduleHide();
}

/**
 * Handle focus out
 */
function handleFocusOut(e) {
    // Check if focus moved to tooltip (shouldn't happen, but be safe)
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && tooltipElement.contains(relatedTarget)) {
        return;
    }
    
    scheduleHide();
}

/**
 * Handle toggle (for touch devices)
 */
function handleToggle(tile, text) {
    if (currentTarget === tile && isTooltipOpen) {
        hideTooltip();
    } else {
        // Clear any pending operations
        if (showTimeout) {
            clearTimeout(showTimeout);
            showTimeout = null;
        }
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        
        showTooltip(tile, text);
    }
}

/**
 * Position tooltip relative to tile
 */
function positionTooltip(tile) {
    const tileRect = tile.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Get tooltip dimensions - use offsetWidth/offsetHeight for reliability
    // These work even when element has opacity 0
    const tooltipWidth = tooltipElement.offsetWidth || CONFIG.maxWidth;
    const tooltipHeight = tooltipElement.offsetHeight || 50;
    
    // Default: bottom center
    let top = tileRect.bottom + CONFIG.offset;
    let left = tileRect.left + (tileRect.width / 2) - (tooltipWidth / 2);
    
    // Check if tooltip would overflow bottom
    if (top + tooltipHeight > viewportHeight) {
        // Flip to top
        top = tileRect.top - tooltipHeight - CONFIG.offset;
    }
    
    // Clamp horizontally to stay on screen
    const minLeft = 10;
    const maxLeft = viewportWidth - tooltipWidth - 10;
    left = Math.max(minLeft, Math.min(maxLeft, left));
    
    // Apply position
    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.left = `${left}px`;
}

/**
 * Handle Escape key
 */
function handleEscape(e) {
    if (e.key === 'Escape' && isTooltipOpen) {
        hideTooltip();
        // Return focus to tile if it was focused
        if (currentTarget && document.activeElement === currentTarget) {
            currentTarget.blur();
        }
    }
}

/**
 * Handle scroll - reposition or close
 */
function handleScroll() {
    if (isTooltipOpen && currentTarget) {
        // Reposition tooltip
        const tooltipText = currentTarget.getAttribute('data-skill-info');
        if (tooltipText) {
            positionTooltip(currentTarget);
        }
    }
}

/**
 * Handle resize - reposition or close
 */
function handleResize() {
    if (isTooltipOpen && currentTarget) {
        // Reposition tooltip
        const tooltipText = currentTarget.getAttribute('data-skill-info');
        if (tooltipText) {
            positionTooltip(currentTarget);
        }
    }
}

/**
 * Handle click outside (for touch devices and tablets)
 */
function handleClickOutside(e) {
    if (!isTooltipOpen) {
        return;
    }
    
    const clickedTile = e.target.closest('.skills__item');
    const clickedTooltip = e.target.closest('.skill-tooltip');
    
    // If clicking the same tile that opened the tooltip, let the tile's click handler toggle it
    if (clickedTile === currentTarget) {
        return;
    }
    
    // If clicking a different tile, close current tooltip (new tile will open its own)
    if (clickedTile && clickedTile !== currentTarget) {
        hideTooltip();
        return;
    }
    
    // On tablets/touch devices, clicking the tooltip itself or outside should close it
    // since there's no hover to keep it open
    if (clickedTooltip || (!clickedTile && !clickedTooltip)) {
        hideTooltip();
    }
}

