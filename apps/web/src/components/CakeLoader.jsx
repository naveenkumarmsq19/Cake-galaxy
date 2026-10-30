import styles from "./CakeLoader.module.css";

/**
 * One reusable Cake Galaxy loader for route, section, form and chat waits.
 * Keep accessibility copy as real text; the animated artwork is decorative.
 */
export default function CakeLoader({ size = "large", fullScreen = false, inline = false, label = "Loading Cake Galaxy…" }) {
  const dimension = ["small", "medium", "large"].includes(size) ? size : "large";
  return (
    <div
      className={[styles.root, styles[dimension], fullScreen ? styles.fullScreen : "", inline ? styles.inline : ""].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-label={label}
      data-cake-loader={dimension}
    >
      <img
        className={styles.art}
        src="/images/loaders/cake-galaxy-outline-loader.svg"
        alt=""
        width="320"
        height="320"
        decoding="async"
      />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
