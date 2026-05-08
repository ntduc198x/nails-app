import Feather from "@expo/vector-icons/Feather";
import { Modal, Pressable, StyleSheet } from "react-native";
import { CachedAppImage } from "@/src/components/cached-app-image";
import { getCustomerImageUri } from "@/src/lib/customer-image-url";
import { useCustomerTheme } from "@/src/providers/customer-preferences-provider";

export function CustomerImagePreviewModal({
  imageUrl,
  onClose,
  visible,
}: {
  imageUrl: string | null;
  onClose: () => void;
  visible: boolean;
}) {
  const theme = useCustomerTheme();
  const resolvedImageUrl = imageUrl ? getCustomerImageUri(imageUrl, "preview") : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.shell} onPress={(event) => event.stopPropagation()}>
          <Pressable
            onPress={onClose}
            style={[
              styles.closeButton,
              {
                backgroundColor: theme.colors.surfaceRaised,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Feather color={theme.colors.text} name="x" size={20} />
          </Pressable>
          {resolvedImageUrl ? (
            <CachedAppImage
              alt="Preview"
              resizeMode="contain"
              source={{ uri: resolvedImageUrl }}
              style={styles.image}
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.84)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  shell: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  closeButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    marginBottom: 12,
    width: 40,
  },
  image: {
    borderRadius: 24,
    height: 420,
    maxHeight: "84%",
    width: "100%",
  },
});
