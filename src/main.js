import './style.css'
import { initCherryBlossoms } from './cherryBlossom'
import { initNodesBackground } from './nodesBackground'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin)

// Initialize wind control object globally to prevent any undefined target errors in GSAP
window.sakuraWind = {
  speedX: 0.8,
  speedY: 1.2,
  wobbleSpeed: 0.02
}

// Wrap initialization in window load event to ensure all styles, images, and DOM structures are fully resolved
window.addEventListener('load', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Start Canvas Particle Systems (only if elements exist)
  if (!prefersReducedMotion && document.getElementById('cherry-blossom-canvas')) {
    initCherryBlossoms('cherry-blossom-canvas');
  }
  if (!prefersReducedMotion && document.getElementById('nodes-canvas')) {
    initNodesBackground('nodes-canvas');
  }

  // ========== INITIAL STATES ==========

  gsap.set("#scene-1", { autoAlpha: 1 })
  gsap.set("#scene-2", { autoAlpha: 0 })
  gsap.set("#scene-3", { autoAlpha: 0 })
  gsap.set("#scene-4", { autoAlpha: 0 })
  gsap.set("#scene-5", { autoAlpha: 0 })

  // Phone starts hidden, centered, scale 1.0 (no scale pop-in)
  gsap.set("#phone-wrapper", { 
    scale: 1.0, 
    y: 0, 
    x: 0,
    autoAlpha: 0, 
    transformOrigin: "center center"
  })
  
  gsap.set("#phone-element", {
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    transformOrigin: "center center"
  })

  // Chat bubbles start hidden
  gsap.set(["#msg-1", "#msg-2", "#msg-3", "#msg-4"], { opacity: 0, y: 15 })
  
  // Scene 4 cards dynamic offset stack
  const cards = gsap.utils.toArray('.deck-card')

  if (prefersReducedMotion) {
    document.documentElement.classList.add('reduce-motion');
    gsap.set('.scene', { autoAlpha: 1, pointerEvents: 'auto' });
    gsap.set('#scene-2, #phone-wrapper', { display: 'none' });
    gsap.set('.crash-content-left, .crash-content-right, .tl-node-container, .tl-bottom-cta', { autoAlpha: 1, scale: 1 });
    gsap.set('.collage-item, .cta-wrapper, .bottom-features-bar', { autoAlpha: 1, scale: 1, x: 0, y: 0 });
    gsap.set('.tl-path-draw', { strokeDashoffset: 0 });
    return;
  }
  
  const calculateCardOffsets = () => {
    const wrapper = document.querySelector('.cards-wrapper');
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperCenterX = wrapperRect.left + wrapperRect.width / 2;
    const wrapperCenterY = wrapperRect.top + wrapperRect.height / 2;

    cards.forEach((card, index) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      
      card._offsetX = wrapperCenterX - cardCenterX;
      card._offsetY = wrapperCenterY - cardCenterY;
    });
  };

  calculateCardOffsets();
  ScrollTrigger.addEventListener('refreshInit', calculateCardOffsets);

  cards.forEach((card, index) => {
    gsap.set(card, {
      x: card._offsetX || 0,
      y: card._offsetY || 0,
      opacity: 0,
      scale: 0.9,
      rotation: index * 0.8 - 2, // Slight fanning in the stack
      transformOrigin: "center center",
      zIndex: index
    });
  });

  // Scene 5 collage and CTA
  gsap.set(".collage-item", { opacity: 0, scale: 0.7, y: 40 })
  gsap.set(".cta-wrapper", { opacity: 0, scale: 0.88 })
  gsap.set(".bottom-features-bar", { opacity: 0, y: 20 })

  // ========== SCROLL INPUT LOCK MANAGER ==========
  // Cap the user's scroll depth during video play so they cannot scroll past the video.
  let isScrollLocked = false;
  let lockScrollY = 0;
  let backupUnlockTimeout = null;

  const forceScrollPosition = () => {
    if (isScrollLocked && window.scrollY > lockScrollY) {
      window.scrollTo(0, lockScrollY);
    }
  };

  const lockScroll = (yPosition) => {
    if (isScrollLocked) return;
    isScrollLocked = true;
    lockScrollY = yPosition !== undefined ? yPosition : window.scrollY;
    window.addEventListener('scroll', forceScrollPosition, { passive: false });

    // Failsafe: Automatically unlock scroll after 8 seconds (zoom video is ~6.4s long)
    clearTimeout(backupUnlockTimeout);
    backupUnlockTimeout = setTimeout(() => {
      if (isScrollLocked) {
        gsap.to(".zoom-video-container", { opacity: 0, duration: 0.3 });
        gsap.to("#phone-wrapper", { autoAlpha: 1, duration: 0.5, ease: "power2.out" });
        unlockScroll();
        videoCompleted = true;
      }
    }, 8000);
  };

  const unlockScroll = () => {
    if (!isScrollLocked) return;
    isScrollLocked = false;
    clearTimeout(backupUnlockTimeout);
    window.removeEventListener('scroll', forceScrollPosition);
  };

  // ========== ZOOM VIDEO SETUP ==========
  const zoomVideo = document.getElementById('zoom-video');
  let videoPlaying = false;
  let videoCompleted = false;

  const triggerChatAnimation = () => {
    gsap.set(["#msg-1", "#msg-2", "#msg-3", "#msg-4"], { opacity: 0, y: 15 });
    const chatTL = gsap.timeline({ delay: 0.2 });
    chatTL.to("#msg-1", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" })
          .to("#msg-2", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, "+=0.4")
          .to("#msg-3", { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "+=0.8")
          .to("#msg-4", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, "+=0.5");
  };

  if (zoomVideo) {
    zoomVideo.addEventListener('ended', () => {
      if (isScrollLocked) {
        gsap.to(".zoom-video-container", { opacity: 0, duration: 0.3 });
        gsap.to("#phone-wrapper", { autoAlpha: 1, duration: 0.5, ease: "power2.out" });
        triggerChatAnimation();
        unlockScroll();
        videoCompleted = true;
      }
    });
    zoomVideo.pause();
  }

  // Real-time animation frame loop to monitor video play and unlock scroll
  const monitorVideoProgress = () => {
    if (zoomVideo && videoPlaying) {
      const duration = zoomVideo.duration || 6.4;
      // Once video is within 0.1 seconds of ending
      if (zoomVideo.currentTime >= duration - 0.1) {
        if (isScrollLocked) {
          // Fade in phone wrapper & fade out video container smoothly
          gsap.to(".zoom-video-container", { opacity: 0, duration: 0.3 });
          gsap.to("#phone-wrapper", { autoAlpha: 1, duration: 0.5, ease: "power2.out" });
          triggerChatAnimation();
          
          unlockScroll();
          videoCompleted = true;
        }
      }
    }
    requestAnimationFrame(monitorVideoProgress);
  };
  requestAnimationFrame(monitorVideoProgress);

  const initTimeline = () => {
    // ========== MASTER SCROLL TIMELINE ==========
    const masterTL = gsap.timeline({
      scrollTrigger: {
        trigger: "#scroll-container",
        start: "top top",
        end: "bottom bottom",
        scrub: 1.5,
        pin: ".viewport",
        anticipatePin: 1,
        onUpdate: (self) => {
          const progress = self.progress;
          // The video trigger is precisely at 3.8s into the timeline.
          // By dividing by total duration, it mathematically adapts to any timeline length!
          const videoStartProgress = 3.8 / masterTL.duration();

          // 1. Enter Scene 2 (scrolling down) -> Lock scroll and play video
          if (progress >= videoStartProgress) {
            if (!videoPlaying && !videoCompleted && zoomVideo) {
              videoPlaying = true;
              // Cap scroll 300px down from current offset
              lockScroll(self.scroll() + 300);
              zoomVideo.currentTime = 0;
              
              // Only fade in Scene 2 when we guarantee the video is moving
              const onPlay = () => {
                gsap.to("#scene-2", { autoAlpha: 1, duration: 0.3 });
                gsap.to(".zoom-video-container", { opacity: 1, duration: 0.3 });
                gsap.to(".classroom-container", { opacity: 0, duration: 0.3 });
                gsap.to("#scene-1", { autoAlpha: 0, duration: 0.3 });
                zoomVideo.removeEventListener("timeupdate", onPlay);
              };
              zoomVideo.addEventListener("timeupdate", onPlay);

              zoomVideo.play().catch(() => {});
            }
          } 
          
          // 2. Scroll back to top (progress < videoStartProgress) -> Full reset
          if (progress < videoStartProgress) {
            if ((videoPlaying || videoCompleted) && zoomVideo) {
              videoPlaying = false;
              videoCompleted = false;
              unlockScroll();
              zoomVideo.pause();
              zoomVideo.currentTime = 0;
              
              // Reset visual layers
              gsap.set("#scene-2", { autoAlpha: 0 });
              gsap.set(".zoom-video-container", { opacity: 0 });
              gsap.set("#scene-1", { autoAlpha: 1 });
              gsap.set(".classroom-container", { opacity: 1 });
              gsap.set("#phone-wrapper", { autoAlpha: 0, y: 0, x: 0, scale: 1.0 });
              gsap.set(["#msg-1", "#msg-2", "#msg-3", "#msg-4"], { opacity: 0, y: 15 });
            }
          }
        }
      }
    });

    // ========== SCENE 1: PANEL REVEAL ==========
    masterTL.to(".white-panel", { 
      y: "100%", 
      duration: 2.0, 
      ease: "power2.inOut" 
    });

    // ========== LOOPING VIDEO SPACER ==========
    // Give the user time to see the looping hero background before transitioning
    masterTL.to({}, { duration: 1.5 });

    // ========== SCENE 1 → SCENE 2 TRANSITION ==========
    masterTL
      .to(".title-overlay", { 
        opacity: 0, 
        duration: 0.3, 
        ease: "power1.out" 
      });

    // ========== CAMERA ZOOM VIDEO SPACER ==========
    // Represents scroll space allocated to the native video zoom while scroll is locked.
    masterTL.to({}, { duration: 3.0 });

    // ========== WHATSAPP CHAT SPACER ==========
    // We removed the chat animations from here, but we need to maintain the same timeline duration 
    // so the hardcoded progress >= 0.27 scroll lock still works perfectly.
    masterTL.to({}, { duration: 3.0 });

    // Dramatic scroll space before drop
    masterTL.to({}, { duration: 1.2 })

    // ========== SCENE 3: CINEMATIC FREEFALL ==========
    masterTL
      .to("#scene-2", { autoAlpha: 0, duration: 0.3 })
      .to(".viewport", { backgroundColor: "#000000", duration: 0.6 }, "<")
      .to("#scene-3", { autoAlpha: 1, duration: 0.3 }, "<+=0.15")

    // Phase 1: Release Drop (phone drops downward out of frame)
    masterTL
      .to("#phone-wrapper", {
        y: "85vh",           // Falls downward out of frame
        scale: 0.45,         // Recedes in perspective
        duration: 0.7,
        ease: "power2.in"
      }, "<")
      .to("#phone-element", {
        rotationX: 45,
        rotationY: 20,
        rotationZ: -15,
        duration: 0.7,
        ease: "power2.in"
      }, "<")

    // Phase 2: Reposition to Top (silently while hidden off-screen)
    masterTL
      .set("#phone-wrapper", { y: "-85vh", scale: 0.5 })
      .set("#phone-element", { rotationX: -180, rotationY: 45, rotationZ: -45 })

    // Phase 3: Accelerating Fall down into the void
    masterTL
      .to("#phone-wrapper", {
        y: "-20vh",
        scale: 0.65,
        duration: 0.8,
        ease: "power1.in"
      })
      .to("#phone-element", {
        rotationX: -360,
        rotationY: 90,
        rotationZ: -90,
        duration: 0.8,
        ease: "power1.in"
      }, "<")

    // Phase 4: Final rush and IMPACT (lands flat in center 0)
    masterTL
      .to("#phone-wrapper", {
        x: 0,
        y: 0,                // Settle flat at center
        scale: 0.75,         // Lands nicely framed
        duration: 0.45,
        ease: "power3.in"
      })
      .to("#phone-element", {
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        duration: 0.45,
        ease: "power3.in"
      }, "<")
      .to("#phone-cracks", { opacity: 1, duration: 0.04 })
      .to("#phone-wrapper", {
        x: "+=14", y: "-=8",
        duration: 0.035, yoyo: true, repeat: 6
      })
      .to("#phone-wrapper", {
        x: 0, y: 0,
        duration: 0.25,
        ease: "power3.out"
      })
      // Animate the Stuck In Cycle layout
      .fromTo(".crash-content-left", 
        { x: -50, autoAlpha: 0 }, 
        { x: 0, autoAlpha: 1, duration: 0.8, ease: "power2.out" }, 
        "-=0.2"
      )
      .fromTo(".crash-content-right", 
        { x: 50, autoAlpha: 0 }, 
        { x: 0, autoAlpha: 1, duration: 0.8, ease: "power2.out" }, 
        "<"
      )

    masterTL.to({}, { duration: 1.0 })

    // ========== SCENE 4: SOLUTION REVEAL (DECK OF CARDS EFFECT) ==========
    masterTL
      .to("#scene-3", { autoAlpha: 0, duration: 0.8 })
      .to("#phone-wrapper", { autoAlpha: 0, duration: 0.8 }, "<")
      .to(".viewport", { backgroundColor: "#ffffff", duration: 0.8 }, "<")
      .to("#scene-4", { autoAlpha: 1, duration: 0.4 }, "-=0.4")
      
      // Solution Header fade-in
      .from(".solution-header", { y: 40, opacity: 0, duration: 1, ease: "power2.out" })

      // Step 1: Open / Spread like a deck of cards from left to right
      .to(cards, { opacity: 1, duration: 0.1 }, "-=0.5")
      .to("#card-1", { x: () => cards[0]._offsetX - 320, y: () => cards[0]._offsetY + 30, rotation: -12, scale: 0.95, duration: 1.0, ease: "power2.out" }, "-=0.6")
      .to("#card-2", { x: () => cards[1]._offsetX - 192, y: () => cards[1]._offsetY + 10, rotation: -7, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")
      .to("#card-3", { x: () => cards[2]._offsetX - 64, y: () => cards[2]._offsetY, rotation: -2, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")
      .to("#card-4", { x: () => cards[3]._offsetX + 64, y: () => cards[3]._offsetY, rotation: 2, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")
      .to("#card-5", { x: () => cards[4]._offsetX + 192, y: () => cards[4]._offsetY + 10, rotation: 7, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")
      .to("#card-6", { x: () => cards[5]._offsetX + 320, y: () => cards[5]._offsetY + 30, rotation: 12, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")

      // Card fanning scroll spacer
      .to({}, { duration: 0.8 })

      // Step 2: Transition to Stage 2 Grid

      // Launch cards back into their natural flat bento grid positions (x:0, y:0)
      .to(cards, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1.0,
        stagger: 0.08,
        duration: 1.2,
        ease: "power3.inOut"
      }, "-=0.2")
      
      // Card detailed content fade in
      .to([".card-content", ".card-number", ".card-bottom-elements", ".scene4-footer"], { 
        opacity: 1, stagger: 0.08, duration: 0.8 
      }, "-=0.8")

    // ========== SCENE 4.5: TIMELINE JOURNEY ==========
    masterTL
      // Fade out Scene 4
      .to("#scene-4", { autoAlpha: 0, duration: 0.8 })
      
      // Setup and fade in Scene 4.5
      .to(".viewport", { backgroundColor: "#fff0f5", duration: 0.5 }, "<")
      .to("#scene-timeline", { autoAlpha: 1, duration: 0.5 }, "-=0.3")
      
      // Get the exact path length for drawing and set it up immediately
      .call(() => {
        const path = document.querySelector(".tl-path-draw");
        if(path) {
          const length = path.getTotalLength();
          path.style.strokeDasharray = length;
          path.style.strokeDashoffset = length;
          path.dataset.length = length;
        }
      })
      
      // Animate the container scrolling up so we can see the full 1600px height over 8s
      // We use a y translation of roughly -1200px (assuming viewport is ~800px tall, 1800 - 800 = 1000px + padding)
      .to(".timeline-container", { 
        y: () => -(document.querySelector(".timeline-container").offsetHeight - window.innerHeight + 200),
        duration: 8.0, 
        ease: "none" 
      }, "timelineScroll")
      
      // Animate the path drawing down over the same 8 seconds
      .to(".tl-path-draw", { strokeDashoffset: 0, duration: 8.0, ease: "none" }, "timelineScroll")
      
      // Pop in the nodes and cards as the line draws past them
      // Node 1 (at ~12.5% of the 8s = 1s in)
      .to(".tl-node-container:nth-child(2)", { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, "timelineScroll+=1.0")
      
      // Node 2 (at ~31.25% of the 8s = 2.5s in)
      .to(".tl-node-container:nth-child(3)", { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, "timelineScroll+=2.5")
      
      // Node 3 (at ~50% of the 8s = 4.0s in)
      .to(".tl-node-container:nth-child(4)", { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, "timelineScroll+=4.0")
      
      // Node 4 (at ~68.75% of the 8s = 5.5s in)
      .to(".tl-node-container:nth-child(5)", { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, "timelineScroll+=5.5")
      
      // Node 5 (at ~87.5% of the 8s = 7.0s in)
      .to(".tl-node-container:nth-child(6)", { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, "timelineScroll+=7.0")
      
      // Spacer to read the final CTA
      .to({}, { duration: 1.5 })

    // ========== SCENE 4.75: RADAR SYSTEM ==========
    masterTL
      .to("#scene-timeline", { autoAlpha: 0, duration: 0.8 })
      .to("#scene-radar", { autoAlpha: 1, duration: 0.5 }, "-=0.3")
      // Animate the entrance of the radar elements
      .from(".radar-circle", { opacity: 0, scale: 0, duration: 0.8, stagger: 0.2, ease: "power2.out" })
      .from(".radar-sweeper", { opacity: 0, duration: 0.5 }, "-=0.4")
      .from(".radar-center-node", { opacity: 0, scale: 0, duration: 0.5, ease: "power3.out" }, "-=0.5")
      .from(".radar-node", { opacity: 0, scale: 0, duration: 0.6, stagger: 0.1, ease: "power3.out" }, "-=0.2")
      .from(".radar-content-left", { opacity: 0, x: -50, duration: 0.8 }, "-=0.8")
      // Let the radar spin while the user scrolls
      .to({}, { duration: 6.0 })

    // ========== SCENE 5: FINAL CTA FRAME (LIGHT SAKURA PORTAL & WIDGETS) ==========
    masterTL
      .to("#scene-radar", { autoAlpha: 0, duration: 0.8 })
      .to(".viewport", { backgroundColor: "#fff0f5", duration: 0.8 }, "<")
      .to("#scene-5", { autoAlpha: 1, duration: 0.4 }, "-=0.4")
      .from(".cta-sakura-svg", { opacity: 0, scale: 0.9, duration: 1.2, ease: "power2.out" }, "-=0.4")
      .from(".cta-side-widget", { opacity: 0, scale: 0.85, y: "-40%", stagger: 0.2, duration: 1.0, ease: "back.out(1.4)" }, "-=0.8")
      .to(".cta-wrapper", { opacity: 1, scale: 1, duration: 1.0, ease: "power2.out" }, "-=0.8")
      .to(".bottom-features-bar", { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "-=0.6")

    ScrollTrigger.refresh()
  }

  // ========== RADAR SYSTEM LOGIC ==========
  let radarAngle = 0;
  const radarNodes = document.querySelectorAll(".radar-node");
  
  // Position nodes
  const positionRadarNodes = () => {
    const radarSystem = document.querySelector('.radar-system');
    if (!radarSystem) return;

    const radius = Math.min(
      260,
      Math.max(window.innerWidth <= 768 ? 96 : 200, radarSystem.clientWidth * (window.innerWidth <= 768 ? 0.29 : 0.34))
    );
    radarNodes.forEach(node => {
      const angle = parseFloat(node.dataset.angle);
      const rad = (angle - 90) * (Math.PI / 180);
      const x = Math.cos(rad) * radius;
      const y = Math.sin(rad) * radius;
      node.style.transform = `translate(${x}px, ${y}px)`;
    });
  };

  positionRadarNodes();
  window.addEventListener('resize', positionRadarNodes);

  let lastRadarUpdate = 0;
  const animateRadar = (timestamp) => {
    if (timestamp - lastRadarUpdate < 120) {
      requestAnimationFrame(animateRadar);
      return;
    }

    lastRadarUpdate = timestamp;
    radarAngle = (radarAngle + 5) % 360;
    const sweeper = document.querySelector(".radar-sweeper");
    if (sweeper) {
      sweeper.style.background = `conic-gradient(from ${radarAngle}deg, transparent 76%, rgba(244, 114, 182, 0.24) 88%, transparent 100%)`;
      
      radarNodes.forEach(node => {
        let nodeAngle = parseFloat(node.dataset.angle); 
        if (nodeAngle < 0) nodeAngle += 360;
        
        let diff = Math.abs(radarAngle - nodeAngle);
        if (diff > 180) diff = 360 - diff;
        
        if (diff < 15) { 
          if (!node.classList.contains("ping")) {
            node.classList.add("ping");
            setTimeout(() => {
              node.classList.remove("ping");
            }, 800);
          }
        }
      });
    }
    requestAnimationFrame(animateRadar);
  };
  requestAnimationFrame(animateRadar);

  // ========== BOOTSTRAP ==========
  if (zoomVideo) {
    if (zoomVideo.readyState >= 1) {
      initTimeline();
    } else {
      zoomVideo.addEventListener('loadedmetadata', initTimeline);
    }
  } else {
  }
})
