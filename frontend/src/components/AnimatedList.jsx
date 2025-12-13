import { motion } from 'framer-motion';
import React from 'react';

/**
 * AnimatedList Component
 * Inspired by React Bits
 * Wraps children with staggered entrance animation
 * Supports scroll-triggered animations using whileInView
 */
export const AnimatedList = ({ children, className = '', delay = 0.1 }) => {
    // Renamed to break inheritance with children
    const containerVariants = {
        containerHidden: { opacity: 0 },
        containerVisible: {
            opacity: 1,
            transition: {
                staggerChildren: delay,
            },
        },
    };

    const itemVariants = {
        hidden: {
            opacity: 0,
            y: 20,
            filter: 'blur(10px)'
        },
        visible: {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            transition: {
                type: 'spring',
                stiffness: 300,
                damping: 24
            }
        },
    };

    return (
        <motion.div
            initial="containerHidden"
            animate="containerVisible"
            variants={containerVariants}
            className={className}
        >
            {React.Children.map(children, (child, index) => {
                // Skip if child is null (e.g. conditional rendering)
                if (!child) return null;

                return (
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-10%" }}
                        variants={itemVariants}
                        className="w-full"
                    >
                        {child}
                    </motion.div>
                );
            })}
        </motion.div>
    );
};

export default AnimatedList;
