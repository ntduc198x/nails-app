import { useEffect, useMemo } from "react";
import type { ImageProps } from "expo-image";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { CachedAppImage } from "@/src/components/cached-app-image";
import {
  prefetchCustomerImages,
} from "@/src/lib/customer-image-cache";
import { getCustomerImageUri, type CustomerImageIntent } from "@/src/lib/customer-image-url";
import { useCustomerTheme } from "@/src/providers/customer-preferences-provider";

type CustomerCachedImageProps = Omit<ImageProps, "source"> & {
  source: { uri: string } | number;
  containerStyle?: StyleProp<ViewStyle>;
  intent?: CustomerImageIntent;
};

export function CustomerCachedImage({
  containerStyle,
  source,
  style,
  intent = "card",
  ...rest
}: CustomerCachedImageProps) {
  const theme = useCustomerTheme();

  const isLocalSource = typeof source === "number";
  const imageUri = useMemo(() => (typeof source === "number" ? "" : source.uri?.trim() ?? ""), [source]);

  const resolvedUri = useMemo(() => getCustomerImageUri(imageUri, intent), [imageUri, intent]);
  const finalUri = resolvedUri || imageUri;

  useEffect(() => {
    if (isLocalSource || !finalUri) {
      return;
    }

    void prefetchCustomerImages([finalUri]);
  }, [finalUri, isLocalSource]);

  const resolvedSource = useMemo(() => {
    if (isLocalSource) return source;
    return finalUri ? { uri: finalUri } : null;
  }, [finalUri, isLocalSource, source]);

  return (
    <View
      style={[
        {
          overflow: "hidden",
          backgroundColor: theme.colors.surfaceMuted,
        },
        containerStyle,
      ]}
    >
      {resolvedSource ? <CachedAppImage source={resolvedSource} style={style} {...rest} /> : null}
    </View>
  );
}
