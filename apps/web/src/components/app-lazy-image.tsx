import Image, { type ImageProps } from "next/image";

type AppLazyImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string;
  alt: string;
  containerClassName?: string;
};

export function AppLazyImage({
  alt,
  className,
  containerClassName,
  priority = false,
  sizes,
  src,
  ...rest
}: AppLazyImageProps) {
  if ("fill" in rest && rest.fill) {
    return (
      <div className={containerClassName ?? "relative"}>
        <Image
          {...rest}
          alt={alt}
          className={className}
          loading={priority ? undefined : "lazy"}
          priority={priority}
          sizes={sizes ?? "100vw"}
          src={src}
        />
      </div>
    );
  }

  return (
    <Image
      {...rest}
      alt={alt}
      className={className}
      loading={priority ? undefined : "lazy"}
      priority={priority}
      sizes={sizes}
      src={src}
    />
  );
}
