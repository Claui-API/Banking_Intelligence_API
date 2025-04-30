// src/hooks/useDelayedAnimation.js
import { useState, useEffect } from 'react';

/**
 * Custom hook to delay animations until the page has fully loaded
 * 
 * @param {Object} options - Hook options
 * @param {number} options.initialDelay - Delay before starting animations (ms)
 * @param {boolean} options.disableOnMobile - Whether to disable animations on mobile devices
 * @returns {boolean} - Whether animations should be active
 */
const useDelayedAnimation = (options = {}) => {
  const { 
    initialDelay = 100, 
    disableOnMobile = false 
  } = options;
  
  const [animationsActive, setAnimationsActive] = useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  
  // Check if the device is mobile
  const isMobile = () => {
    return window.innerWidth <= 768 || 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };
  
  // Handle page load
  useEffect(() => {
    // Mark the page as loaded when component mounts
    const handlePageLoaded = () => {
      setPageLoaded(true);
    };
    
    // If the page is already loaded
    if (document.readyState === 'complete') {
      handlePageLoaded();
    } else {
      // Otherwise wait for it to load
      window.addEventListener('load', handlePageLoaded);
      
      // Clean up
      return () => {
        window.removeEventListener('load', handlePageLoaded);
      };
    }
  }, []);
  
  // Delay animations after page load
  useEffect(() => {
    if (!pageLoaded) return;
    
    // Check if animations should be disabled on mobile
    if (disableOnMobile && isMobile()) {
      // Immediately activate without animations
      setAnimationsActive(true);
      return;
    }
    
    // Set a timeout for the initial delay
    const timer = setTimeout(() => {
      setAnimationsActive(true);
    }, initialDelay);
    
    // Clear the timeout if the component unmounts
    return () => clearTimeout(timer);
  }, [pageLoaded, initialDelay, disableOnMobile]);
  
  return animationsActive;
};

/**
 * Generate staggered animation delays for multiple elements
 * 
 * @param {Object} options - Options for staggered delays
 * @param {number} options.baseDelay - Base delay before first animation (ms)
 * @param {number} options.staggerDelay - Delay between each element (ms)
 * @param {number} options.index - Index of the current element
 * @returns {number} - Total delay for the element
 */
export const getStaggeredDelay = (options = {}) => {
  const { 
    baseDelay = 500, 
    staggerDelay = 200,
    index = 0
  } = options;
  
  return baseDelay + (index * staggerDelay);
};

export default useDelayedAnimation;