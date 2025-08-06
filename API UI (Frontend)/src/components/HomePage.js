import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Row, Col, Button, Card, Image } from 'react-bootstrap';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import CountUp from 'react-countup';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import useDelayedAnimation, { getStaggeredDelay } from '../hooks/useDelayedAnimation';
import './HomePage.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeBlock = ({ code, language = 'javascript' }) => (
  <SyntaxHighlighter
    language={language}
    style={oneDark}
    customStyle={{
      fontSize: '0.9rem',
      background: 'transparent',
    }}
    codeTagProps={{
      style: {
        background: 'transparent'
      }
    }}
  >
    {code}
  </SyntaxHighlighter>
);

const step1 = `
  Step 1: Create an account and get your API key
  API_KEY = "your_api_key_here"
  `;

const step2 = `Step 2: Send financial data
  user_data = {"{"}
  "accounts": [...],
  "transactions": [...]
 {"}"}
 `;

const step3 = `Step 3: Request insights
  insights = api.get_insights(
    query="How can I save money?",
    user_data=user_data
  )`;

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.3,
      staggerChildren: 0.2
    }
  }
};

const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.7, ease: "easeOut" }
  }
};

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const controls = useAnimation();
  const [scrollY, setScrollY] = useState(0);
  const [videoFade, setVideoFade] = useState("hidden");
  const videoRef = useRef(null);
  // Reduce loading time by showing content sooner
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  // Add a timeout ref to clear it if component unmounts
  const timeoutRef = useRef(null);

  // Use our custom hook to delay animations until page is loaded
  const animationsActive = useDelayedAnimation({
    initialDelay: 200, // Increased delay before starting animations
    disableOnMobile: false // Set to true to disable animations on mobile
  });

  // References for animations
  const [featuresRef, featuresInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [howItWorksRef, howItWorksInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [ctaRef, ctaInView] = useInView({ threshold: 0.5, triggerOnce: true });
  const [videoSectionRef, videoSectionInView] = useInView({
    threshold: 0.1,
    triggerOnce: false,
    rootMargin: "-100px 0px" // Slightly earlier detection
  });

  // Initialize particles with a ref to ensure it only loads once
  const particlesInitialized = useRef(false);
  const particlesInit = async (main) => {
    if (!particlesInitialized.current) {
      await loadFull(main);
      particlesInitialized.current = true;

      // Optimize for mobile
      const isMobile = window.innerWidth < 768;
      if (isMobile && main.particles) {
        // Reduce particle count on mobile
        if (main.particles.options.particles) {
          main.particles.options.particles.number.value = 15;
          main.particles.options.particles.move.speed = 0.5;
        }
      }
    }
  };

  useEffect(() => {
    const handleResize = () => {
      // Check if we're in the problematic range
      const width = window.innerWidth;
      if (width >= 350 && width <= 470) {
        // Add a class to the body for targeted styling
        document.body.classList.add('narrow-screen-fix');
      } else {
        document.body.classList.remove('narrow-screen-fix');
      }
    };

    // Initial check
    handleResize();

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.body.classList.remove('narrow-screen-fix');
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      // Force re-render on orientation change for better mobile layout
      setScrollY(window.scrollY);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Force content to show after a max timeout (to avoid infinite loading)
  useEffect(() => {
    if (animationsActive) {
      // Set a maximum time to wait for video (3 seconds)
      timeoutRef.current = setTimeout(() => {
        if (!contentVisible) {
          setVideoLoaded(true);
          setContentVisible(true);
        }
      }, 3000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [animationsActive, contentVisible]);

  // Video fade in/out effect when the video plays
  useEffect(() => {
    if (videoRef.current && animationsActive) {
      // Add event listeners for video fade effects
      const videoElement = videoRef.current;

      // Add event listener for the loadeddata event to know when video is ready
      const handleVideoLoaded = () => {
        setVideoLoaded(true);
        // Show content immediately
        setContentVisible(true);

        // Ensure proper looping
        videoElement.loop = true;
      };

      // Check if metadata is loaded
      const handleMetadataLoaded = () => {
        // If video metadata loads quickly, we can start showing things
        if (videoElement.readyState >= 1) {
          // Set a shorter timeout to show content even if full data isn't loaded yet
          setTimeout(() => {
            setVideoLoaded(true);
            setContentVisible(true);
          }, 100);
        }
      };

      // Listen for video loaded events - try to detect loading as early as possible
      videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);
      videoElement.addEventListener('loadeddata', handleVideoLoaded);

      // Handle video play event for fade in
      const handlePlay = () => {
        videoElement.classList.remove('video-fade-out');
        videoElement.classList.add('video-fade-in');
      };

      // Handle looping behavior explicitly
      const handleEnded = () => {
        // Explicitly restart the video if it ends
        videoElement.currentTime = 0;
        videoElement.play().catch(e => console.log('Video autoplay prevented by browser'));
      };

      videoElement.addEventListener('play', handlePlay);
      videoElement.addEventListener('ended', handleEnded);

      return () => {
        // Clean up event listeners
        videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
        videoElement.removeEventListener('loadeddata', handleVideoLoaded);
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('ended', handleEnded);
      };
    }
  }, [videoRef, animationsActive]);

  // Trigger animations when sections come into view
  useEffect(() => {
    if (featuresInView && animationsActive) {
      controls.start('visible');
    }
  }, [controls, featuresInView, animationsActive]);

  // Video fade in/out effect
  useEffect(() => {
    if (videoSectionInView) {
      // Fade in when in view
      setVideoFade("visible");
    } else {
      // Fade out when out of view
      setVideoFade("hidden");
    }
  }, [videoSectionInView]);

  // Preload video when animations are active and modify loading sequence
  useEffect(() => {
    if (animationsActive && videoRef.current) {
      // Set preload attribute to auto to prioritize video loading
      videoRef.current.preload = "auto";

      // Set lower quality for faster loading
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
      videoRef.current.loop = true; // Explicitly set loop to true

      // Load the video
      videoRef.current.load();

      // Try to play as soon as possible
      videoRef.current.play().catch(e => {
        console.log('Video autoplay prevented by browser, will try again when user interacts');
      });

      // If video has already loaded the metadata, check if it's fully loaded
      if (videoRef.current.readyState >= 1) {
        // Show content faster
        setTimeout(() => {
          setVideoLoaded(true);
          setContentVisible(true);
        }, 100);
      }
    }
  }, [animationsActive]);

  return (
    <div className="home-page-container">
      {/* Particles Background - only show after animations are active */}
      {animationsActive && (
        <Particles
          id="tsparticles"
          init={particlesInit}
          options={{
            fullScreen: {
              enable: false,
              zIndex: -1
            },
            particles: {
              number: {
                value: 30, // Reduced from original for better performance
                density: {
                  enable: true,
                  value_area: 1000
                }
              },
              color: {
                value: "#28a745"
              },
              opacity: {
                value: 0.3,
                random: true
              },
              size: {
                value: 3,
                random: true
              },
              line_linked: {
                enable: true,
                distance: 150,
                color: "#28a745",
                opacity: 0.2,
                width: 1
              },
              move: {
                enable: true,
                speed: 0.8, // Slower speed for better performance
                direction: "none",
                random: true,
                straight: false,
                out_mode: "out",
                bounce: false
              }
            },
            interactivity: {
              detect_on: "canvas",
              events: {
                onhover: {
                  enable: true,
                  mode: "grab"
                },
                onclick: {
                  enable: true,
                  mode: "push"
                }
              },
              modes: {
                grab: {
                  distance: 140,
                  line_linked: {
                    opacity: 0.5
                  }
                },
                push: {
                  particles_nb: 2 // Reduced for better performance
                }
              }
            },
            retina_detect: true
          }}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            zIndex: -1
          }}
        />
      )}

      {/* Full-width background video section - Now wraps the entire content */}
      <div
        ref={videoSectionRef}
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          marginBottom: '2rem'
        }}
      >
        {/* Background Video - Full width */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: videoLoaded ? 0.4 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            className="background-video"
          >
            <source src="videos/Amazon_Rainforest_Video_for_App.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </motion.div>

        {/* Loading overlay - shows until video is loaded */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
            zIndex: videoLoaded ? 0 : 1
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: videoLoaded ? 0 : 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Header section with motion - now inside the video section */}
        <AnimatePresence>
          {animationsActive && contentVisible && (
            <motion.div
              className="text-center py-4"
              initial={{ opacity: 0, y: -25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <Container>
                <motion.h1
                  className="text-white mb-0 mobile-responsive-title"
                  style={{
                    fontSize: '3.5rem', // This will be overridden by media queries in CSS
                    fontWeight: '900',
                    letterSpacing: '-0.03em',
                    fontFamily: "'Inter Display', 'Inter', sans-serif",
                    textTransform: 'none'
                  }}
                  animate={{
                    textShadow: [
                      "0 0 5px rgba(40, 167, 69, 0.3)",
                      "0 0 15px rgba(40, 167, 69, 0.5)",
                      "0 0 5px rgba(40, 167, 69, 0.3)"
                    ]
                  }}
                  transition={{
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    delay: 0.8
                  }}
                >
                  Banking Intelligence API
                </motion.h1>
              </Container>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content overlay with YouTube video */}
        <Container className="py-5 text-center" style={{ position: 'relative', zIndex: 1 }}>
          <AnimatePresence>
            {animationsActive && contentVisible && (
              <motion.div
                className="mb-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }} // Reduced delay
              >
                <motion.div
                  className="mx-auto mb-5 mobile-video-container"
                  style={{
                    maxWidth: '700px',
                    background: 'linear-gradient(90deg, #00c6ff, #ff00de)',
                    padding: '2px',
                    borderRadius: '4px',
                    position: 'relative',
                  }}
                  whileHover={{
                    boxShadow: "0 0 25px rgba(0, 198, 255, 0.5)"
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <div style={{
                    background: 'rgba(20, 20, 20, 0.85)',
                    padding: '15px',
                    borderRadius: '2px'
                  }}>
                    {/* YouTube video embed with responsive container */}
                    <div className="narrow-screen-container">
                      <div className="ratio ratio-16x9 mobile-responsive-video">
                        <iframe
                          src="https://www.youtube.com/embed/hMO6E50YSXU?si=KLrgifAyC5Pb1uCC"
                          title="Banking Intelligence Demo"
                          allowFullScreen
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        ></iframe>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.p
                  className="text-white mx-auto"
                  style={{ maxWidth: '700px', fontSize: '1.5rem', textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }} // Reduced delay
                >
                  Add AI-powered financial insights to your banking application with the CLAU Banking Intelligence API
                </motion.p>

                <motion.div
                  className="d-flex justify-content-center gap-3 mt-4 mobile-button-container"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }} // Reduced delay
                >
                  {isAuthenticated ? (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-100 mobile-btn-wrapper">
                      <Link to="/dashboard" className="btn btn-success btn-lg mobile-action-btn">
                        Go to API Dashboard
                      </Link>
                    </motion.div>
                  ) : (
                    <>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="mobile-btn-wrapper">
                        <Link to="/register" className="btn btn-success btn-lg mobile-action-btn">
                          Get Your API Key
                        </Link>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="mobile-btn-wrapper">
                        <Link to="/docs" className="btn btn-outline-success btn-lg mobile-action-btn">
                          View Documentation
                        </Link>
                      </motion.div>
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </Container>
      </div> {/* End of full-width background video section */}

      {/* Stats Counter Section - only display counters after animations are active and content is visible */}
      <Container className="py-4">
        <motion.div
          className="text-center stats-container"
          initial={{ opacity: 0 }}
          animate={animationsActive && contentVisible ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }} // Reduced delay
        >
          <Row className="mobile-stats-row">
            <Col md={4} sm={6} className="mobile-stat-col">
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-graph-up"></i>
                </div>
                <h2 className="text-white mobile-stat-number">
                  {animationsActive && <CountUp end={98} suffix="%" duration={2.5} delay={0.2} />}
                </h2>
                <p className="text-light mobile-stat-label">API Uptime</p>
              </div>
            </Col>
            <Col md={4} sm={6} className="mobile-stat-col">
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-people"></i>
                </div>
                <h2 className="text-white mobile-stat-number">
                  {animationsActive && <CountUp end={50} duration={3} delay={0.3} />}+
                </h2>
                <p className="text-white mobile-stat-label">Beta Testing Now</p>
              </div>
            </Col>
            <Col md={4} sm={12} className="mobile-stat-col">
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-clock-history"></i>
                </div>
                <h2 className="text-white mobile-stat-number">
                  {animationsActive && <CountUp end={1500} suffix="ms" duration={2} delay={0.4} />}
                </h2>
                <p className="text-white mobile-stat-label">Average Response Time</p>
              </div>
            </Col>
          </Row>
        </motion.div>
      </Container>

      {/* Features section */}
      <Container className="py-4">
        <motion.div
          ref={featuresRef}
          initial="hidden"
          animate={featuresInView && animationsActive ? "visible" : "hidden"}
          variants={staggerContainer}
          className="features-container"
        >
          <Row className="g-4 mobile-features-row">
            <Col md={4} sm={12} className="mobile-feature-col">
              <motion.div variants={scaleIn}>
                <Card className="h-100 text-white border-secondary feature-card mobile-feature-card">
                  <Card.Body>
                    <div className="text-success mb-3 feature-icon">
                      <i className="bi bi-graph-up-arrow" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <Card.Title>Contextualized Insights</Card.Title>
                    <Card.Text>
                      Transform raw financial data into personalized insights that help your users make better financial decisions.
                    </Card.Text>
                  </Card.Body>
                </Card>
              </motion.div>
            </Col>

            <Col md={4} sm={12} className="mobile-feature-col">
              <motion.div variants={scaleIn}>
                <Card className="h-100 text-white border-secondary feature-card mobile-feature-card">
                  <Card.Body>
                    <div className="text-success mb-3 feature-icon">
                      <i className="bi bi-robot" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <Card.Title>AI-Powered Analysis</Card.Title>
                    <Card.Text>
                      CLAU's advanced AI analyzes spending patterns, identifies savings opportunities, and provides smart recommendations.
                    </Card.Text>
                  </Card.Body>
                </Card>
              </motion.div>
            </Col>

            <Col md={4} sm={12} className="mobile-feature-col">
              <motion.div variants={scaleIn}>
                <Card className="h-100 text-white border-secondary feature-card mobile-feature-card">
                  <Card.Body>
                    <div className="text-success mb-3 feature-icon">
                      <i className="bi bi-code-square" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <Card.Title>Simple Integration</Card.Title>
                    <Card.Text>
                      Easy-to-use REST API with comprehensive documentation. Integrate with your app in minutes, not days.
                    </Card.Text>
                  </Card.Body>
                </Card>
              </motion.div>
            </Col>
          </Row>
        </motion.div>
      </Container>

      {/* How it works section */}
      <motion.div
        ref={howItWorksRef}
        initial="hidden"
        animate={howItWorksInView && animationsActive && contentVisible ? "visible" : "hidden"}
        variants={staggerContainer}
        className="py-5 rounded my-5"
      >
        <Container>
          <motion.h2
            className="text-success text-center mb-5"
            variants={fadeIn}
          >
            How It Works
          </motion.h2>

          <motion.div variants={fadeIn}>
            <Row className="align-items-center mb-5 mobile-step-row">
              <Col md={6} sm={12} className="mobile-step-text">
                <motion.div
                  className="bg-success p-4 rounded mb-3 mb-md-0 w-100 mobile-step-content"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">1. Register for an API Key</h4>
                  <p className="text-black">Create an account and get your API key to integrate our services.</p>
                </motion.div>
              </Col>
              <Col md={6} sm={12} className="mobile-step-code">
                <motion.pre
                  className="bg-black p-4 rounded text-white code-block w-100 mobile-code-block"
                  initial={{ x: 50, opacity: 0 }}
                  animate={howItWorksInView && animationsActive ? { x: 0, opacity: 1 } : { x: 50, opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <CodeBlock code={step1} language="javascript" />
                </motion.pre>
              </Col>
            </Row>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Row className="align-items-center mb-5 mobile-step-row">
              <Col md={{ span: 6, order: 'last' }} sm={12} className="mobile-step-text">
                <motion.div
                  className="bg-success p-4 rounded mb-3 mb-md-0 w-100 mobile-step-content"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">2. Connect User Data</h4>
                  <p className="text-black">Send financial data to our API via secure endpoints.</p>
                </motion.div>
              </Col>
              <Col md={6} sm={12} className="mobile-step-code">
                <motion.pre
                  className="bg-black p-3 rounded text-white code-block w-100 mobile-code-block"
                  initial={{ x: -50, opacity: 0 }}
                  animate={howItWorksInView && animationsActive ? { x: 0, opacity: 1 } : { x: -50, opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <CodeBlock code={step2} language="javascript" />
                </motion.pre>
              </Col>
            </Row>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Row className="align-items-center mobile-step-row">
              <Col md={6} sm={12} className="mobile-step-text">
                <motion.div
                  className="bg-success p-4 rounded mb-3 mb-md-0 w-100 mobile-step-content"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">3. Get Personalized Insights</h4>
                  <p className="text-black">Receive AI-powered financial insights to display in your app.</p>
                </motion.div>
              </Col>
              <Col md={6} sm={12} className="mobile-step-code">
                <motion.pre
                  className="bg-black p-3 rounded text-white code-block w-100 mobile-code-block"
                  initial={{ x: 50, opacity: 0 }}
                  animate={howItWorksInView && animationsActive ? { x: 0, opacity: 1 } : { x: 50, opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <CodeBlock code={step3} language="javascript" />
                </motion.pre>
              </Col>
            </Row>
          </motion.div>
        </Container>
      </motion.div>

      {/* Call to action */}
      <motion.div
        ref={ctaRef}
        initial={{ opacity: 0, y: 50 }}
        animate={ctaInView && animationsActive && contentVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
        className="py-5 cta-section mobile-cta-section"
      >
        <Container className="text-center">
          <motion.h2
            className="text-success mb-4 mobile-cta-title"
            animate={ctaInView && animationsActive ?
              { scale: [1, 1.05, 1], textShadow: "0 0 8px rgba(40, 167, 69, 0.5)" } : {}
            }
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
          >
            Ready to enhance your banking app?
          </motion.h2>
          <motion.p
            className="text-light mb-4 mobile-cta-text"
            animate={ctaInView && animationsActive ? { opacity: [0.7, 1, 0.7] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Join fintech companies already using our API to provide personalized financial guidance
          </motion.p>
          <motion.div
            className="d-inline-block p-2 rounded mobile-cta-button-wrapper"
            whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(40, 167, 69, 0.5)" }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to={isAuthenticated ? "/dashboard" : "/register"} className="btn btn-success btn-lg mobile-cta-button">
              {isAuthenticated ? "Go to Dashboard" : "Get Started Today"}
            </Link>
          </motion.div>
        </Container>
      </motion.div>
    </div>
  );
};

export default HomePage;