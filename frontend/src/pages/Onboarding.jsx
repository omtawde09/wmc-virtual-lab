import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { cn } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

import { ElegantShape } from "../components/ui/ElegantShape";

import "./Onboarding.css";

const slides = [
    {
        badge: "Virtual Lab",
        title1: "Welcome to",
        title2: "Virtual Lab",
        description: "Run your Wireless & Mobile Communication experiments using live Wi-Fi and Bluetooth measurements."
    },
    {
        badge: "Real Data",
        title1: "Every Reading",
        title2: "Measured Live",
        description: "Nothing is simulated. Signal strength, throughput and channel data come from your own wireless adapter."
    },
    {
        badge: "Experiments",
        title1: "Six Guided",
        title2: "Experiments",
        description: "Signal strength, throughput and latency, Bluetooth, path loss, multipath fading and interference."
    },
    {
        badge: "Setup",
        title1: "Run the Local",
        title2: "Backend First",
        description: "Your radios can only be read on your own machine, so a small Windows helper does the measuring."
    }
];

function Onboarding() {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(prev => prev + 1);
        } else {
            handleGetStarted();
        }
    };

    const handlePrevious = () => {
        if (currentSlide > 0) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    const handleGetStarted = () => {
        localStorage.setItem('onboardingCompleted', 'true');
        navigate('/');
    };

    const fadeUpVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                delay: 0.2 + i * 0.1,
                ease: [0.25, 0.4, 0.25, 1],
            },
        }),
        exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
    };

    const slide = slides[currentSlide];

    return (
        <div className="onboarding-root">
            <div className="onboarding-glow" />

            <div className="onboarding-shapes">
                <ElegantShape
                    delay={0.3}
                    width={600}
                    height={140}
                    rotate={12}
                    gradient="from-indigo-500/[0.15]"
                    className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
                />

                <ElegantShape
                    delay={0.5}
                    width={500}
                    height={120}
                    rotate={-15}
                    gradient="from-rose-500/[0.15]"
                    className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
                />

                <ElegantShape
                    delay={0.4}
                    width={300}
                    height={80}
                    rotate={-8}
                    gradient="from-violet-500/[0.15]"
                    className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
                />

                <ElegantShape
                    delay={0.6}
                    width={200}
                    height={60}
                    rotate={20}
                    gradient="from-amber-500/[0.15]"
                    className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
                />

                <ElegantShape
                    delay={0.7}
                    width={150}
                    height={40}
                    rotate={-25}
                    gradient="from-cyan-500/[0.15]"
                    className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
                />
            </div>

            <div className="onboarding-container">
                <div className="onboarding-inner">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentSlide}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={{
                                hidden: { opacity: 0 },
                                visible: { opacity: 1 },
                                exit: { opacity: 0 }
                            }}
                        >


                            <motion.div
                                custom={1}
                                variants={fadeUpVariants}
                            >
                                <h1 className="onboarding-heading">
                                    <span className="onboarding-title-1">
                                        {slide.title1}
                                    </span>
                                    <br />
                                    <span
                                        className={cn(
                                            "onboarding-title-2"
                                        )}
                                    >
                                        {slide.title2}
                                    </span>
                                </h1>
                            </motion.div>

                            <motion.div
                                custom={2}
                                variants={fadeUpVariants}
                            >
                                <p className="onboarding-description">
                                    {slide.subtitle ? (
                                        <span className="onboarding-subtitle">
                                            {slide.subtitle}
                                        </span>
                                    ) : null}
                                    {slide.description}
                                </p>
                            </motion.div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="onboarding-controls">
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: currentSlide === 0 ? 0.3 : 1 }}
                            disabled={currentSlide === 0}
                            onClick={handlePrevious}
                            className="onboarding-prev-btn"
                            aria-label="Previous"
                        >
                            <ChevronLeft size={20} />
                        </motion.button>

                        <div className="onboarding-dot-row">
                            {slides.map((_, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "onboarding-dot",
                                        index === currentSlide ? "is-active" : ""
                                    )}
                                />
                            ))}
                        </div>

                        <motion.button
                            onClick={handleNext}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="onboarding-next-btn"
                        >
                            {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
                            <ArrowRight size={16} className="onboarding-arrow" />
                        </motion.button>
                    </div>
                </div>
            </div>

            <div className="onboarding-vignette" />
        </div>
    );
}

export default Onboarding;
