"use client";

import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";

// Register Chinese font for CJK character support
Font.register({
  family: "NotoSansSC",
  fonts: [
    {
      src: "/fonts/NotoSansSC-Regular.ttf",
      fontWeight: 400,
    },
    {
      src: "/fonts/NotoSansSC-Bold.ttf",
      fontWeight: 700,
    },
  ],
});

interface PreformattedOrderRow {
  header: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  items: string;
  total: string;
  payment: string;
  paymentPaid: boolean;
  notes: string;
}

interface RoutePDFProps {
  rows: PreformattedOrderRow[];
  totalDistance: string;
  totalDuration: string;
  adjustedDuration: string;
  adjustedDetail: string;
  restaurantAddress: string;
  restaurantLatLng: { lat: number; lng: number } | null;
  apiKey: string;
  endAddress: string;
  orderCount: number;
}

function buildStaticMapUrl(
  rows: PreformattedOrderRow[],
  restaurantLatLng: { lat: number; lng: number } | null,
  apiKey: string
): string {
  const deliveryStops = rows.filter((r) => r.lat !== 0 || r.lng !== 0);
  if (deliveryStops.length === 0 && !restaurantLatLng) return "";

  const params = new URLSearchParams();
  params.set("size", "640x300");
  params.set("maptype", "roadmap");
  params.set("key", apiKey);

  if (restaurantLatLng) {
    params.append(
      "markers",
      `color:green|label:S|${restaurantLatLng.lat},${restaurantLatLng.lng}`
    );
  }

  deliveryStops.forEach((r, i) => {
    params.append(
      "markers",
      `color:red|label:${String(i + 1)}|${r.lat},${r.lng}`
    );
  });

  const allPoints: { lat: number; lng: number }[] = [];
  if (restaurantLatLng) allPoints.push(restaurantLatLng);
  deliveryStops.forEach((r) => allPoints.push({ lat: r.lat, lng: r.lng }));

  const pathCoords = allPoints.map((s) => `${s.lat},${s.lng}`).join("|");
  params.append("path", `color:0xEA580CFF|weight:4|${pathCoords}`);

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "NotoSansSC", fontSize: 9, color: "#1c1917" },
  header: { marginBottom: 16, borderBottom: "2 solid #1c1917", paddingBottom: 10 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#57534e", marginBottom: 2 },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  summaryBox: { flex: 1, padding: 8, backgroundColor: "#ecfdf5" },
  summaryLabel: { fontSize: 7, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, color: "#047857", marginBottom: 2 },
  summaryValue: { fontSize: 12, fontWeight: "bold", color: "#064e3b" },
  summaryDetail: { fontSize: 7, color: "#059669", marginTop: 2 },
  mapImage: { width: "100%", height: 200, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginBottom: 10, borderBottom: "1 solid #d6d3d1", paddingBottom: 4 },
  orderGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  orderCard: { width: "48%", padding: 8, border: "1 solid #d6d3d1", marginBottom: 4 },
  orderHeader: { fontSize: 10, fontWeight: "bold", marginBottom: 4, color: "#1c1917" },
  orderRow: { flexDirection: "row", marginBottom: 1 },
  orderLabel: { width: 40, color: "#78716c", fontSize: 7, fontWeight: "bold", textTransform: "uppercase" },
  orderValue: { flex: 1, fontSize: 7, color: "#44403c" },
  orderValuePaid: { flex: 1, fontSize: 7, color: "#059669", fontWeight: "bold" },
  orderValueUnpaid: { flex: 1, fontSize: 7, color: "#d97706", fontWeight: "bold" },
  footer: { position: "absolute", bottom: 20, left: 30, right: 30, textAlign: "center", fontSize: 7, color: "#a8a29e", borderTop: "1 solid #e7e5e4", paddingTop: 8 },
});

export default function RoutePDF({
  rows,
  totalDistance,
  totalDuration,
  adjustedDuration,
  adjustedDetail,
  restaurantAddress,
  restaurantLatLng,
  apiKey,
  endAddress,
  orderCount,
}: RoutePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Delivery Route Plan</Text>
          <Text style={styles.subtitle}>Restaurant: {restaurantAddress}</Text>
          {endAddress ? <Text style={styles.subtitle}>Ends at: {endAddress}</Text> : null}
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString("en-AU", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Distance</Text>
            <Text style={styles.summaryValue}>{totalDistance}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Driving</Text>
            <Text style={styles.summaryValue}>{totalDuration}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Time</Text>
            <Text style={styles.summaryValue}>{adjustedDuration}</Text>
            {adjustedDetail ? <Text style={styles.summaryDetail}>{adjustedDetail}</Text> : null}
          </View>
        </View>

        {apiKey ? <Image src={buildStaticMapUrl(rows, restaurantLatLng, apiKey)} style={styles.mapImage} /> : null}

        <Text style={styles.sectionTitle} break>
          Delivery Orders ({orderCount})
        </Text>

        <View style={styles.orderGrid}>
          {rows.map((row, idx) => (
            <View key={idx} style={styles.orderCard} wrap={false}>
              <Text style={styles.orderHeader}>{row.header}</Text>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Phone</Text>
                <Text style={styles.orderValue}>{row.phone}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Address</Text>
                <Text style={styles.orderValue}>{row.address}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Items</Text>
                <Text style={styles.orderValue}>{row.items}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Total</Text>
                <Text style={styles.orderValue}>{row.total}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Payment</Text>
                <Text style={row.paymentPaid ? styles.orderValuePaid : styles.orderValueUnpaid}>
                  {row.payment}
                </Text>
              </View>
              {row.notes ? (
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Notes</Text>
                  <Text style={styles.orderValue}>{row.notes}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Generated by Ordering System — {new Date().toLocaleDateString("en-AU")}
        </Text>
      </Page>
    </Document>
  );
}
