import styles from "./LoadingSkeleton.module.css";

/** Retains the space and shape of the content without fake product information. */
export default function LoadingSkeleton({ layout = "products", count = 4, label = "Loading cakes…" }) {
  const type = ["products", "categories", "rows", "detail"].includes(layout) ? layout : "products";
  return <div className={styles.root} role="status" aria-live="polite" aria-label={label} data-loader-variant="skeleton">
    <span className={styles.srOnly}>{label}</span>
    <div className={styles[type]} aria-hidden="true">
      {Array.from({ length: type === "detail" ? 1 : count }, (_, index) => <div className={styles.item} key={index}>
        {type !== "rows" && <div className={styles.photo}/>}
        <div className={styles.copy}><div className={styles.line}/><div className={styles.shortLine}/>{type === "detail" && <><div className={styles.line}/><div className={styles.field}/><div className={styles.field}/><div className={styles.field}/></>}</div>
      </div>)}
    </div>
  </div>;
}

export function LoadingPage({ title, ...props }) {
  return <div className="wrap page"><div className="page-heading"><h1>{title}</h1></div><LoadingSkeleton {...props}/></div>;
}
