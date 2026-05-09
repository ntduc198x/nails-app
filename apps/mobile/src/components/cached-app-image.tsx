import { Image, type ImageProps as ExpoImageProps } from "expo-image";
import { View, type StyleProp, type ViewStyle } from "react-native";

type CachedAppImageProps = ExpoImageProps & {
  alt?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

function mapResizeModeToContentFit(resizeMode: ExpoImageProps["resizeMode"], contentFit: ExpoImageProps["contentFit"]) {
  if (contentFit) return contentFit;
  if (resizeMode === "contain") return "contain";
  if (resizeMode === "stretch") return "fill";
  return "cover";
}

export function CachedAppImage({
  alt,
  accessibilityLabel,
  cachePolicy = "memory-disk",
  containerStyle,
  contentFit,
  resizeMode,
  style,
  transition = 150,
  ...rest
}: CachedAppImageProps) {
  return (
    <View style={containerStyle}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image
        {...rest}
        accessibilityLabel={alt ?? accessibilityLabel}
        cachePolicy={cachePolicy}
        contentFit={mapResizeModeToContentFit(resizeMode, contentFit)}
        resizeMode={resizeMode}
        style={style}
        transition={transition}
      />
    </View>
  );
}
