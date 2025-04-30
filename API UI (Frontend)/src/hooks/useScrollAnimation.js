// src/hooks/useScrollAnimation.js
import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for scroll-based animations
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Visibility threshold (0 to 1)
 * @param {boolean} options.triggerOnce - Whether to trigger animation only once
 * @param {number} options.delay - Delay before animation starts (ms)
 * @param {string} options.animation - Animation type ('fadeIn', 'slideUp', etc.)
 * @returns {Array} - [ref, inView, animationClass]
 */
const useScrollAnimation = (options = {}) => {
  const {
    threshold = 0.1,
    triggerOnce = true,
    delay = 0,
    animation = 'fadeIn'
  } = options;
  
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const [animationClass, setAnimationClass] = useState('');
  
  useEffect(() => {
    const currentRef = ref.current;
    
    if (!currentRef) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Check if element is intersecting
        if (entry.isIntersecting) {
          // Add delay if specified
          if (delay) {
            setTimeout(() => {
              setInView(true);
              setAnimationClass(`animate-${animation}`);
            }, delay);
          } else {
            setInView(true);
            setAnimationClass(`animate-${animation}`);
          }
          
          // Unobserve if triggerOnce is true
          if (triggerOnce) {
            observer.unobserve(currentRef);
          }
        } else if (!triggerOnce) {
          // Reset if not triggering once
          setInView(false);
          setAnimationClass('');
        }
      },
      { threshold }
    );
    
    observer.observe(currentRef);
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, triggerOnce, delay, animation]);
  
  return [ref, inView, animationClass];
};

/**
 * Scroll-based animation for multiple elements with staggered delay
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Visibility threshold (0 to 1)
 * @param {boolean} options.triggerOnce - Whether to trigger animation only once
 * @param {number} options.baseDelay - Base delay before animations start (ms)
 * @param {number} options.staggerDelay - Delay between each child animation (ms)
 * @param {string} options.animation - Animation type ('fadeIn', 'slideUp', etc.)
 * @returns {Array} - [ref, inView, getAnimationProps]
 */
export const useStaggeredAnimation = (options = {}) => {
  const {
    threshold = 0.1,
    triggerOnce = true,
    baseDelay = 0,
    staggerDelay = 100,
    animation = 'fadeIn'
  } = options;
  
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  
  useEffect(() => {
    const currentRef = ref.current;
    
    if (!currentRef) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          
          if (triggerOnce) {
            observer.unobserve(currentRef);
          }
        } else if (!triggerOnce) {
          setInView(false);
        }
      },
      { threshold }
    );
    
    observer.observe(currentRef);
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, triggerOnce]);
  
  // Function to generate props for child elements
  const getAnimationProps = (index = 0) => {
    return {
      className: inView ? `animate-${animation}` : '',
      style: {
        opacity: 0,
        animation: inView ? `${animation} 0.6s forwards` : 'none',
        animationDelay: inView ? `${baseDelay + (index * staggerDelay)}ms` : '0ms'
      }
    };
  };
  
  return [ref, inView, getAnimationProps];
};

// Animation utility function to add scroll animations to any element
export const addScrollAnimations = () => {
  useEffect(() => {
    const animatedElements = document.querySelectorAll('.scroll-animate');
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    
    animatedElements.forEach(element => {
      observer.observe(element);
    });
    
    return () => {
      animatedElements.forEach(element => {
        observer.unobserve(element);
      });
    };
  }, []);
};

export default useScrollAnimation;