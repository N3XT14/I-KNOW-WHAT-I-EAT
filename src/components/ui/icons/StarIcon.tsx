export default function StarIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.9 6.6L22 9.6l-5 4.6L18.2 21 12 17.3 5.8 21 7 14.2 2 9.6l7.1-1z" />
    </svg>
  );
}
