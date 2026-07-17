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
  console.log("Aether Landing Page: Initializing GSAP and ScrollTrigger...");

  // Start Canvas Particle Systems (only if elements exist)
  if (document.getElementById('cherry-blossom-canvas')) {
    initCherryBlossoms('cherry-blossom-canvas');
  }
  if (document.getElementById('nodes-canvas')) {
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
  gsap.set(["#msg-1", "#msg-2", "#msg-3"], { opacity: 0, y: 15 })
  
  // Shock text starts hidden
  gsap.set("#shock-text", { autoAlpha: 0, scale: 0.8 })

  // Scene 4 cards dynamic offset stack
  const cards = gsap.utils.toArray('.deck-card')
  
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
  gsap.set(".cta-box", { opacity: 0, scale: 0.88 })

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
    console.log("Aether Scroll Lock Enabled at Y:", lockScrollY);
    window.addEventListener('scroll', forceScrollPosition, { passive: false });

    // Failsafe: Automatically unlock scroll after 8 seconds (zoom video is ~6.4s long)
    clearTimeout(backupUnlockTimeout);
    backupUnlockTimeout = setTimeout(() => {
      if (isScrollLocked) {
        console.warn("Failsafe scroll unlock triggered.");
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
    console.log("Aether Scroll Lock Disabled");
    clearTimeout(backupUnlockTimeout);
    window.removeEventListener('scroll', forceScrollPosition);
  };

  // ========== ZOOM VIDEO SETUP ==========
  const zoomVideo = document.getElementById('zoom-video');
  let videoPlaying = false;
  let videoCompleted = false;

  if (zoomVideo) {
    zoomVideo.addEventListener('ended', () => {
      if (isScrollLocked) {
        console.log("Video naturally ended. Transitioning phone & unlocking scroll...");
        gsap.to(".zoom-video-container", { opacity: 0, duration: 0.3 });
        gsap.to("#phone-wrapper", { autoAlpha: 1, duration: 0.5, ease: "power2.out" });
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
          console.log("Video close to end. Transitioning phone & unlocking scroll...");
          
          // Fade in phone wrapper & fade out video container smoothly
          gsap.to(".zoom-video-container", { opacity: 0, duration: 0.3 });
          gsap.to("#phone-wrapper", { autoAlpha: 1, duration: 0.5, ease: "power2.out" });
          
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

          // 1. Enter Scene 2 (scrolling down) -> Lock scroll and play video
          if (progress >= 0.02) {
            if (!videoPlaying && !videoCompleted && zoomVideo) {
              videoPlaying = true;
              console.log("Playing zoom video natively...");
              // Cap scroll 200px down from current offset
              lockScroll(self.scroll() + 200);
              zoomVideo.currentTime = 0;
              zoomVideo.play().catch(e => console.log("Video playback error:", e));
            }
          } 
          
          // 2. Scroll back to top (progress < 0.02) -> Full reset
          if (progress < 0.02) {
            if ((videoPlaying || videoCompleted) && zoomVideo) {
              videoPlaying = false;
              videoCompleted = false;
              unlockScroll();
              console.log("Resetting zoom video...");
              zoomVideo.pause();
              zoomVideo.currentTime = 0;
              
              // Reset visual layers
              gsap.set(".zoom-video-container", { opacity: 1 });
              gsap.set("#phone-wrapper", { autoAlpha: 0, y: 0, x: 0, scale: 1.0 });
              gsap.set(["#msg-1", "#msg-2", "#msg-3"], { opacity: 0, y: 15 });
            }
          }
        }
      }
    });

    // ========== SCENE 1 → SCENE 2 TRANSITION ==========
    masterTL
      .to(".title-overlay", { 
        opacity: 0, 
        duration: 0.3, 
        ease: "power1.out" 
      })
      .to("#scene-2", { autoAlpha: 1, duration: 0.3 }, "<")
      .to(".zoom-video-container", { opacity: 1, duration: 0.3 }, "<")
      .to(".classroom-container", { opacity: 0, duration: 0.3 }, "<")
      .to("#scene-1", { autoAlpha: 0, duration: 0.3 }, "<")

    // ========== CAMERA ZOOM VIDEO SPACER ==========
    // Represents scroll space allocated to the native video zoom while scroll is locked.
    masterTL.to({}, { duration: 3.0 });

    // ========== WHATSAPP CHAT REVEALS DIRECTLY ON SCROLL ==========
    masterTL.to("#msg-1", { 
      opacity: 1, y: 0, duration: 0.5, ease: "power1.out" 
    }, "+=0.1")

    masterTL.to("#msg-2", { 
      opacity: 1, y: 0, duration: 0.5, ease: "power1.out" 
    }, "+=0.25")

    masterTL.to("#msg-3", { 
      opacity: 1, y: 0, duration: 0.7, ease: "power1.out" 
    }, "+=0.25")

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
        scale: 0.6,          // Recedes in perspective
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

    // Phase 2: Reposition to Top (silently while hidden)
    masterTL
      .to("#phone-wrapper", { autoAlpha: 0, duration: 0.05 })
      .set("#phone-wrapper", { y: "-85vh", scale: 0.65 })
      .set("#phone-element", { rotationX: -180, rotationY: 45, rotationZ: -45 })
      .to("#phone-wrapper", { autoAlpha: 1, duration: 0.05 })

    // Phase 3: Accelerating Fall down into the void
    masterTL
      .to("#phone-wrapper", {
        y: "-30vh",
        scale: 0.85,
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
        scale: 1.0,          // Lands flat at design scale
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
        ease: "elastic.out(1, 0.4)"
      })

    // Phase 5: "Why so shocked?" text appears on cracked screen
    masterTL.to("#shock-text", {
      autoAlpha: 1,
      scale: 1,
      duration: 1.0,
      ease: "back.out(1.5)"
    }, "-=0.15")

    masterTL.to({}, { duration: 1.0 })

    // ========== SCENE 4: SOLUTION REVEAL (DECK OF CARDS EFFECT) ==========
    masterTL
      .to("#scene-3", { autoAlpha: 0, duration: 0.8 })
      .to("#phone-wrapper", { autoAlpha: 0, duration: 0.8 }, "<")
      .to(".viewport", { backgroundColor: "#0c0a15", duration: 0.8 }, "<")
      .to("#scene-4", { autoAlpha: 1, duration: 0.4 }, "-=0.4")
      .to(".sunlight-beam", { scale: 22, duration: 1.8, ease: "power2.out" }, "-=0.6")
      
      // Solution Header fade-in
      .from(".solution-header", { y: 40, opacity: 0, duration: 1, ease: "power2.out" })

      // Step 1: Open / Spread like a deck of cards from left to right
      .to(cards, { opacity: 1, duration: 0.1 })
      .to("#card-1", { x: () => cards[0]._offsetX - 320, y: () => cards[0]._offsetY + 30, rotation: -12, scale: 0.95, duration: 1.0, ease: "power2.out" }, "-=0.6")
      .to("#card-2", { x: () => cards[1]._offsetX - 192, y: () => cards[1]._offsetY + 10, rotation: -7, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")
      .to("#card-3", { x: () => cards[2]._offsetX - 64, y: () => cards[2]._offsetY, rotation: -2, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")
      .to("#card-4", { x: () => cards[3]._offsetX + 64, y: () => cards[3]._offsetY, rotation: 2, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")
      .to("#card-5", { x: () => cards[4]._offsetX + 192, y: () => cards[4]._offsetY + 10, rotation: 7, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")
      .to("#card-6", { x: () => cards[5]._offsetX + 320, y: () => cards[5]._offsetY + 30, rotation: 12, scale: 0.95, duration: 1.0, ease: "power2.out" }, "<")

      // Card fanning scroll spacer
      .to({}, { duration: 0.8 })

      // Step 2: Launch cards back into their natural flat bento grid positions (x:0, y:0)
      .to(cards, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1.0,
        stagger: 0.08,
        duration: 1.2,
        ease: "power3.inOut"
      })
      
      // Card content legibility fade in
      .to(".card-content", { 
        opacity: 1, stagger: 0.08, duration: 0.8 
      }, "-=0.8")

    // ========== SCENE 5: FINAL CTA FRAME ==========
    masterTL
      .to("#scene-4", { autoAlpha: 0, duration: 0.8 })
      .to(".classroom-container-scene5", { opacity: 1, duration: 0.8 }, "<")
      .to(".viewport", { backgroundColor: "#07050e", duration: 0.8 }, "<")
      .to("#scene-5", { autoAlpha: 1, duration: 0.4 }, "-=0.4")
      .to(".obj-tower", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=0.4")
      .to(".obj-dish", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")
      .to(".obj-router", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")
      .to(".obj-cables", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")
      .to(".obj-mobile", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")
      .to(".obj-sim", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")
      .to(".cta-box", { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }, "-=1.0")

    ScrollTrigger.refresh()
  }

  // ========== BOOTSTRAP ==========
  if (zoomVideo) {
    if (zoomVideo.readyState >= 1) {
      initTimeline();
    } else {
      zoomVideo.addEventListener('loadedmetadata', initTimeline);
    }
  } else {
    console.error("Zoom video element not found!");
  }
})
