// src/components/common/AnimationWrapper.js
import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Animation wrapper component for creating scroll-based animations
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child elements to animate
 * @param {string} props.type - Animation type (fadeIn, slideUp, scale, etc.)
 * @param {number} props.delay - Delay before starting animation in seconds
 * @param {number} props.duration - Animation duration in seconds
 * @param {number} props.threshold - Visibility threshold (0 to 1)
 * @param {boolean} props.once - Whether to trigger animation only once
 * @param {Object} props.customVariants - Custom animation variants
 * @param {string} props.className - Additional CSS classes
 * @returns {React.ReactElement} Animated component
 */
const AnimationWrapper = ({
  children,
  type = 'fadeIn',
  delay = 0,
  duration = 0.6,
  threshold = 0.1,
  once = true,
  customVariants,
  className = '',
  ...props
}) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef(null);
  
  // Animation variants
  const variants = {
    fadeIn: {
      hidden: { opacity: 0 },
      visible: { 
        opacity: 1,
        transition: {
          duration,
          delay
        }
      }
    },
    slideUp: {
      hidden: { opacity: 0, y: 50 },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: {
          duration,
          delay
        }
      }
    },
    slideDown: {
      hidden: { opacity: 0, y: -50 },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: {
          duration,
          delay
        }
      }
    },
    slideLeft: {
      hidden: { opacity: 0, x: 50 },
      visible: { 
        opacity: 1, 
        x: 0,
        transition: {
          duration,
          delay
        }
      }
    },
    slideRight: {
      hidden: { opacity: 0, x: -50 },
      visible: { 
        opacity: 1, 
        x: 0,
        transition: {
          duration,
          delay
        }
      }
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { 
        opacity: 1, 
        scale: 1,
        transition: {
          duration,
          delay
        }
      }
    },
    scaleRotate: {
      hidden: { opacity: 0, scale: 0.8, rotate: -10 },
      visible: { 
        opacity: 1, 
        scale: 1,
        rotate: 0,
        transition: {
          duration,
          delay
        }
      }
    },
    bounce: {
      hidden: { opacity: 0, y: 50, scale: 0.9 },
      visible: { 
        opacity: 1, 
        y: 0,
        scale: 1,
        transition: {
          duration,
          delay,
          type: 'spring',
          stiffness: 200,
          damping: 15
        }
      }
    }
  };
  
  // Use provided custom variants or select from predefined ones
  const animationVariants = customVariants || variants[type] || variants.fadeIn;
  
  useEffect(() => {
    const currentRef = ref.current;
    
    if (!currentRef) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) {
            observer.unobserve(currentRef);
          }
        } else if (!once) {
          setIsInView(false);
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
  }, [threshold, once]);
  
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={animationVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * Animation wrapper for a group of elements with staggered animations
 */
export const StaggeredAnimationGroup = ({
  children,
  type = 'fadeIn',
  delay = 0,
  staggerDelay = 0.1,
  duration = 0.6,
  threshold = 0.1,
  once = true,
  customVariants,
  className = '',
  ...props
}) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef(null);
  
  // Container variants
  const containerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: delay,
        staggerChildren: staggerDelay
      }
    }
  };
  
  // Child variants
  const childVariants = {
    fadeIn: {
      hidden: { opacity: 0 },
      visible: { 
        opacity: 1,
        transition: { duration }
      }
    },
    slideUp: {
      hidden: { opacity: 0, y: 50 },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration }
      }
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { 
        opacity: 1, 
        scale: 1,
        transition: { duration }
      }
    },
    bounce: {
      hidden: { opacity: 0, y: 50, scale: 0.9 },
      visible: { 
        opacity: 1, 
        y: 0,
        scale: 1,
        transition: {
          duration,
          type: 'spring',
          stiffness: 200,
          damping: 15
        }
      }
    }
  };
  
  // Use provided custom variants or select from predefined ones
  const itemVariants = customVariants || childVariants[type] || childVariants.fadeIn;
  
  useEffect(() => {
    const currentRef = ref.current;
    
    if (!currentRef) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) {
            observer.unobserve(currentRef);
          }
        } else if (!once) {
          setIsInView(false);
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
  }, [threshold, once]);
  
  // Process children to add animation variants
  const staggeredChildren = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return (
        <motion.div variants={itemVariants}>
          {child}
        </motion.div>
      );
    }
    return child;
  });
  
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={containerVariants}
      className={className}
      {...props}
    >
      {staggeredChildren}
    </motion.div>
  );
};

export default AnimationWrapper;