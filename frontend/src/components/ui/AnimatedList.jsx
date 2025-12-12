import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils";

/**
 * AnimatedList Component from ReactBits
 * Displays a list of items with staggered animation
 * 
 * @param {Object} props
 * @param {React.ReactNode[]} props.children - List items to animate
 * @param {string} props.className - Additional CSS classes
 * @param {number} props.delay - Delay between each item animation in ms (default: 1000)
 */
export function AnimatedList({
    children,
    className,
    delay = 1000
}) {
    const [index, setIndex] = useState(0);
    const childrenArray = useMemo(() =>
        Array.isArray(children) ? children : [children],
        [children]
    );

    useEffect(() => {
        if (index < childrenArray.length - 1) {
            const timeout = setTimeout(() => {
                setIndex(prev => prev + 1);
            }, delay);
            return () => clearTimeout(timeout);
        }
    }, [index, delay, childrenArray.length]);

    const visibleItems = useMemo(() =>
        childrenArray.slice(0, index + 1),
        [childrenArray, index]
    );

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            {visibleItems.map((item, i) => (
                <AnimatedListItem key={i}>
                    {item}
                </AnimatedListItem>
            ))}
        </div>
    );
}

function AnimatedListItem({ children }) {
    return (
        <div
            className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ease-out fill-mode-both"
            style={{ animationFillMode: 'both' }}
        >
            {children}
        </div>
    );
}

/**
 * AnimatedListDemo - Example usage component
 * Shows notifications appearing one by one
 */
export function AnimatedListDemo() {
    const notifications = [
        {
            name: "Schema Created",
            description: "New schema 'customer_sync' was added",
            icon: "📊",
            color: "#00C853",
            time: "Just now",
        },
        {
            name: "Job Completed",
            description: "Daily sync completed successfully",
            icon: "✅",
            color: "#4CAF50",
            time: "2m ago",
        },
        {
            name: "Agent Connected",
            description: "windows-agent-1 is now online",
            icon: "🔗",
            color: "#2196F3",
            time: "5m ago",
        },
        {
            name: "Warning",
            description: "Network latency detected on node-3",
            icon: "⚠️",
            color: "#FF9800",
            time: "10m ago",
        },
    ];

    return (
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Recent Activity</h3>
            <AnimatedList delay={800}>
                {notifications.map((item, idx) => (
                    <div
                        key={idx}
                        className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 backdrop-blur-sm"
                    >
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                            style={{ backgroundColor: `${item.color}20` }}
                        >
                            {item.icon}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-white">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.description}</p>
                        </div>
                        <span className="text-xs text-slate-500">{item.time}</span>
                    </div>
                ))}
            </AnimatedList>
        </div>
    );
}

export default AnimatedList;
