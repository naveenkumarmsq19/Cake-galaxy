"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LoadingImage.module.css";

// No wrapper or opacity: preserve image layout, SSR/no-JS images and lazy loading.
export default function LoadingImage({ src, srcSet, className = "", onLoad, onError, alt = "", ...props }) {
  const image = useRef(null);
  const [settled, setSettled] = useState(null);
  const source = `${src || ""}|${srcSet || ""}`;
  const pending = settled?.source !== source;
  const failed = !pending && settled.failed;
  useEffect(() => {
    if (image.current?.complete) setSettled({ source, failed: !image.current.naturalWidth });
  }, [source]);
  return <img {...props} ref={image} src={failed ? "/images/cake-galaxy-sage-logo.webp" : src}
    srcSet={failed ? undefined : srcSet} alt={failed ? (alt ? `${alt} — photo unavailable` : "Photo unavailable") : alt}
    className={[className, pending ? styles.shimmer : "", failed ? styles.failed : ""].filter(Boolean).join(" ")}
    data-image-state={pending ? "loading" : failed ? "error" : "loaded"}
    onLoad={event => { if (!failed) { setSettled({ source, failed: false }); onLoad?.(event); } }}
    onError={event => { setSettled({ source, failed: true }); onError?.(event); }}/>
}
