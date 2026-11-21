type Props = {
  name: string;
};

export default function BrandMark({ name }: Props) {
  return (
    <div className="flex items-center gap-[0.7cqi]">
      {name === "Stone" ? (
        <img
          src="/images/icon.png"
          alt="Stone logo"
          className="h-[3.3cqi] w-auto object-contain dark:invert"
        />
      ) : (
        <svg
          viewBox="0 0 40 32"
          className="h-[3.3cqi] w-auto tint text-neutral-900 dark:text-white"
          fill="none"
          aria-hidden
        >
          <g fill="currentColor">
            <path d="M6 4h9c-4.5 2-7.6 5.6-9.4 10L2 14c1-4 1.9-7.2 4-10Z" />
            <path d="M14 4h9c-5 2.6-8.4 6.2-10.4 10.6l-4.2-.2C10.2 9.9 11.6 6.6 14 4Z" opacity=".75" />
            <path d="M23 4h9c-6 3.2-10.1 7-12.3 11.6l-4.4-.4C17.6 10.4 19.9 6.8 23 4Z" opacity=".5" />
            <path d="M2.6 18.4 30 16.6c-4.6 6-12 10.4-22.4 12.6 0 0-3.6-5-5-10.8Z" />
          </g>
        </svg>
      )}
      <span className="font-display font-bold tracking-[-0.02em] tint text-neutral-900 dark:text-white text-[2.7cqi]">
        {name}
        <sup className="ml-[0.4cqi] align-super text-[1.25cqi] font-medium tracking-normal">
          ®
        </sup>
      </span>
    </div>
  );
}