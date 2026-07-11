import styles from './ListSkeleton.module.css'

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row} />
      ))}
    </div>
  )
}
