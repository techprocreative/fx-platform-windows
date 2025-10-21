'use client';

/**
 * SkipLink Component
 * 
 * Provides skip links for keyboard navigation to improve accessibility
 * following WCAG 2.1 AA guidelines.
 */

import { useEffect, useRef } from 'react';
import { createSkipLink } from '@/lib/accessibility/keyboard-navigation';

interface SkipLinkProps {
  /** Target element ID to skip to */
  targetId: string;
  /** Text to display on the skip link */
  label?: string;
  /** Custom className for styling */
  className?: string;
}

export function SkipLink({ 
  targetId, 
  label = 'Skip to main content', 
  className 
}: SkipLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || linkRef.current) return;

    const skipLink = createSkipLink(target, label);
    if (className) {
      skipLink.className += ` ${className}`;
    }

    // Insert at the beginning of body
    document.body.insertBefore(skipLink, document.body.firstChild);
    linkRef.current = skipLink;

    return () => {
      if (linkRef.current && linkRef.current.parentNode) {
        linkRef.current.parentNode.removeChild(linkRef.current);
      }
    };
  }, [targetId, label, className]);

  return null;
}

/**
 * MultipleSkipLinks Component
 * 
 * Provides multiple skip links for different sections
 */
interface SkipLinkItem {
  targetId: string;
  label: string;
}

interface MultipleSkipLinksProps {
  links: SkipLinkItem[];
  className?: string;
}

export function MultipleSkipLinks({ links, className }: MultipleSkipLinksProps) {
  return (
    <>
      {links.map((link) => (
        <SkipLink
          key={link.targetId}
          targetId={link.targetId}
          label={link.label}
          className={className}
        />
      ))}
    </>
  );
}

/**
 * Default skip links for the application
 */
export function DefaultSkipLinks() {
  const skipLinks = [
    { targetId: 'main-content', label: 'Skip to main content' },
    { targetId: 'navigation', label: 'Skip to navigation' },
    { targetId: 'search', label: 'Skip to search' },
  ];

  return <MultipleSkipLinks links={skipLinks} />;
}