import { PAYMENT_METHODS } from "@/src/features/customer/data";
import { CustomerScreen, InfoRow, SectionTitle, SurfaceCard } from "@/src/features/customer/ui";

export default function PaymentMethodsScreen() {
  return (
    <CustomerScreen title="Phuong thuc thanh toan" subtitle="Danh sach payment methods theo style card + list">
      <SurfaceCard>
        <SectionTitle title="Phuong thuc dang ho tro" subtitle="San sang dung cho flow dat lich va checkout sau nay" />
        {PAYMENT_METHODS.map((item) => (
          <InfoRow key={item.id} title={item.title} detail={item.detail} />
        ))}
      </SurfaceCard>
    </CustomerScreen>
  );
}
