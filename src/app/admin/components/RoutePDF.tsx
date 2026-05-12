"use client";

import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

interface RouteStop {
  index: number;
  address: string;
  lat: number;
  lng: number;
  label: string;
}

interface StopWithOrder {
  stop: RouteStop;
  stopNum: number;
  order: {
    id: string;
    contact: string;
    items: { quantity: number; name: string; price: number }[];
    total: number;
    paid: boolean;
    notes: string;
  } | null;
}

interface RoutePDFProps {
  stopsWithOrders: StopWithOrder[];
  totalDistance: string;
  totalDuration: string;
  adjustedDuration?: string;
  adjustedDetail?: string;
  restaurantAddress: string;
  restaurantLatLng: { lat: number; lng: number } | null;
  apiKey: string;
  endAddress?: string;
  orderCount: number;
}

function buildStaticMapUrl(
  stops: RouteStop[],
  restaurantLatLng: { lat: number; lng: number } | null,
  apiKey: string
): string {
  if (!stops.length) return "";

  const allPoints = restaurantLatLng ? stops : stops;

  const params = new URLSearchParams();
  params.set("size", "640x300");
  params.set("maptype", "roadmap");
  params.set("key", apiKey);

  // Let Google auto-fit: don't set center or zoom when markers/path are provided

  if (restaurantLatLng) {
    params.append(
      "markers",
      `color:green|label:S|${restaurantLatLng.lat},${restaurantLatLng.lng}`
    );
  }

  const deliveryStops = restaurantLatLng ? stops.slice(0) : stops.slice(1);
  deliveryStops.forEach((stop, i) => {
    params.append(
      "markers",
      `color:red|label:${String(i + 1)}|${stop.lat},${stop.lng}`
    );
  });

  const pathCoords = allPoints.map((s) => `${s.lat},${s.lng}`).join("|");
  params.append("path", `color:0xEA580CFF|weight:4|${pathCoords}`);

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1c1917",
  },
  header: {
    marginBottom: 16,
    borderBottom: "2 solid #1c1917",
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#57534e",
    marginBottom: 2,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  summaryBox: {
    flex: 1,
    padding: 8,
    backgroundColor: "#ecfdf5",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#047857",
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#064e3b",
  },
  summaryDetail: {
    fontSize: 7,
    color: "#059669",
    marginTop: 2,
  },
  mapImage: {
    width: "100%",
    height: 200,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 10,
    borderBottom: "1 solid #d6d3d1",
    paddingBottom: 4,
  },
  orderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  orderCard: {
    width: "48%",
    padding: 8,
    border: "1 solid #d6d3d1",
    marginBottom: 4,
  },
  orderHeader: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#1c1917",
  },
  orderRow: {
    flexDirection: "row",
    marginBottom: 1,
  },
  orderLabel: {
    width: 40,
    color: "#78716c",
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  orderValue: {
    flex: 1,
    fontSize: 7,
    color: "#44403c",
  },
  orderValuePaid: {
    flex: 1,
    fontSize: 7,
    color: "#059669",
    fontWeight: "bold",
  },
  orderValueUnpaid: {
    flex: 1,
    fontSize: 7,
    color: "#d97706",
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 7,
    color: "#a8a29e",
    borderTop: "1 solid #e7e5e4",
    paddingTop: 8,
  },
});

export default function RoutePDF({
  stopsWithOrders,
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
  const stops = stopsWithOrders.map((swo) => swo.stop);
  const staticMapUrl = buildStaticMapUrl(stops, restaurantLatLng, apiKey);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Delivery Route Plan</Text>
          <Text style={styles.subtitle}>Restaurant: {restaurantAddress}</Text>
          {endAddress && <Text style={styles.subtitle}>Ends at: {endAddress}</Text>}
          <Text style={styles.subtitle}>
            Generated:{" "}
            {new Date().toLocaleDateString("en-AU", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {/* Summary */}
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
            <Text style={styles.summaryValue}>{adjustedDuration || totalDuration}</Text>
            {adjustedDetail && <Text style={styles.summaryDetail}>{adjustedDetail}</Text>}
          </View>
        </View>

        {/* Static Map */}
        {staticMapUrl && <Image src={staticMapUrl} style={styles.mapImage} />}

        {/* Order List — start on a fresh page */}
        <Text style={styles.sectionTitle} break>
          Delivery Orders ({orderCount})
        </Text>

        <View style={styles.orderGrid}>
          {stopsWithOrders.map((swo) => {
            const order = swo.order;
            return (
              <View key={swo.stop.index} style={styles.orderCard} wrap={false}>
                <Text style={styles.orderHeader}>
                  #{order?.id || swo.stop.label} — Stop {swo.stopNum}
                </Text>

                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Phone</Text>
                  <Text style={styles.orderValue}>{order?.contact || "—"}</Text>
                </View>

                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Address</Text>
                  <Text style={styles.orderValue}>{swo.stop.address}</Text>
                </View>

                {order && (
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Items</Text>
                    <Text style={styles.orderValue}>
                      {order.items
                        .map((item) => `${item.quantity}x ${item.name}`)
                        .join(", ")}
                    </Text>
                  </View>
                )}

                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Total</Text>
                  <Text style={styles.orderValue}>
                    ${order?.total.toFixed(2) || "—"}
                  </Text>
                </View>

                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Payment</Text>
                  <Text
                    style={
                      order?.paid
                        ? styles.orderValuePaid
                        : styles.orderValueUnpaid
                    }
                  >
                    {order?.paid ? "Paid ✓" : "Unpaid ✗"}
                  </Text>
                </View>

                {order?.notes && (
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Notes</Text>
                    <Text style={styles.orderValue}>{order.notes}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by Ordering System —{" "}
          {new Date().toLocaleDateString("en-AU")}
        </Text>
      </Page>
    </Document>
  );
}
