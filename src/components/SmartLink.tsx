import { ExternalLink } from "lucide-react";
import type { AnchorHTMLAttributes } from "react";

export function isExternalUrl(href?: string) {
  return Boolean(href && /^https?:\/\//i.test(href));
}

export function SmartLink({ href, children, target, rel, externalIcon = true, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { externalIcon?: boolean }) {
  const external = isExternalUrl(href);
  return (
    <a
      href={href}
      target={external ? "_blank" : target}
      rel={external ? "noreferrer" : rel}
      {...props}
    >
      {children}
      {external && externalIcon && <ExternalLink aria-hidden="true" className="ml-1 inline-block align-[-2px]" size={13} strokeWidth={2} />}
    </a>
  );
}
