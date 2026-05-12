"use client";

import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import type { Order } from "../../../data/types";

interface RouteStop {
  index: number;
  address: string;
  lat: number;
  lng: number;
  label: string;
}

interface RouteResult {
  stops: RouteStop[];
  totalDistance: string;
  totalDuration: string;
  orderSummary: string[];
  totalDistanceKm?: number;
  totalDurationSeconds?: number;
  polyline?: string;
  _mock?: boolean;
}

interface RoutePDFProps {
  routeResult: RouteResult;
  orders: Order[];
  restaurantAddress: string;
  restaurantLatLng: { lat: number; lng: number } | null;
  apiKey: string;
  endAddress?: string;
  adjustedDuration?: string;
  adjustedDetail?: string;
}

function buildStaticMapUrl(
  stops: RouteStop[],
  restaurantLatLng: { lat: number; lng: number } | null,
  apiKey: string
): string {
  if (!stops.length) return "";

  const origin = restaurantLatLng || { lat: stops[0].lat, lng: stops[0].lng };
  const allPoints = restaurantLatLng ? stops : stops;
  
  // Center on the midpoint
  const lats = allPoints.map((s) => s.lat);
  const lngs = allPoints.map((s) => s.lng);
  if (restaurantLatLng) {
    lats.unshift(restaurantLatLng.lat);
    lngs.unshift(restaurantLatLng.lng);
  }
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  const params = new URLSearchParams();
  params.set("size", "600x400");
  params.set("scale", "2");
  params.set("maptype", "roadmap");
  params.set("center", `${centerLat},${centerLng}`);
  params.set("key", apiKey);

  // Restaurant marker
  if (restaurantLatLng) {
    params.append(
      "markers",
      `color:green|label:S|${restaurantLatLng.lat},${restaurantLatLng.lng}`
    );
  }

  // Stop markers (numbered)
  const deliveryStops = restaurantLatLng ? stops.slice(0) : stops.slice(1);
  deliveryStops.forEach((stop, i) => {
    const label = String(i + 1);
    params.append(
      "markers",
      `color:red|label:${label}|${stop.lat},${stop.lng}`
    );
  });

  // Route path
  const pathCoords = allPoints.map((s) => `${s.lat},${s.lng}`).join("|");
  params.append("path", `color:0xEA580CFF|weight:4|${pathCoords}`);

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function orderToRows(order: Order): string[][] {
  const items = order.items
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ");
  return [
    ["Order #", order.id],
    ["Contact", order.contact],
    ["Address", order.address],
    ["Items", items],
    ["Total", `$${order.total.toFixed(2)}`],
    ["Payment", order.paid ? "Paid ✓" : "Unpaid ✗"],
    ["Notes", order.notes || "—"],
  ];
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
    borderRadius: 4,
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
    borderRadius: 4,
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
  paidBadge: {
    color: "#059669",
  },
  unpaidBadge: {
    color: "#d97706",
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
  routeResult,
  orders,
  restaurantAddress,
  restaurantLatLng,
  apiKey,
  endAddress,
  adjustedDuration,
  adjustedDetail,
}: RoutePDFProps) {
  const staticMapUrl = buildStaticMapUrl(
    routeResult.stops,
    restaurantLatLng,
    apiKey
  );

  // Build a lookup of order by address/contact to match route stops
  const getOrderForStop = (stop: RouteStop): Order | undefined => {
    return orders.find((o) => stop.label.startsWith(`#${o.id}`));
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Delivery Route Plan</Text>
          <Text style={styles.subtitle}>
            Restaurant: {restaurantAddress}
          </Text>
          {endAddress && (
            <Text style={styles.subtitle}>Ends at: {endAddress}</Text>
          )}
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString("en-AU", {
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
            <Text style={styles.summaryValue}>
              {routeResult.totalDistance}
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Driving</Text>
            <Text style={styles.summaryValue}>
              {routeResult.totalDuration}
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Time</Text>
            <Text style={styles.summaryValue}>
              {adjustedDuration || routeResult.totalDuration}
            </Text>
            {adjustedDetail && (
              <Text style={styles.summaryDetail}>{adjustedDetail}</Text>
            )}
          </View>
        </View>

        {/* Static Map */}
        {staticMapUrl && (
          <Image src={staticMapUrl} style={styles.mapImage} />
        )}

        {/* Order List */}
        <Text style={styles.sectionTitle}>
          Delivery Orders ({routeResult.stops.filter((s, i) => i > 0 || !restaurantLatLng).length})
        </Text>

        <View style={styles.orderGrid}>
          {routeResult.stops
            .filter((stop, i) => {
              // Skip the start marker (restaurant) if we have restaurantLatLng
              if (i === 0 && restaurantLatLng) return false;
              return true;
            })
            .map((stop) => {
              const order = getOrderForStop(stop);
              const stopNum = restaurantLatLng
                ? routeResult.stops.indexOf(stop)
                : routeResult.stops.indexOf(stop);
              return (
                <View key={stop.index} style={styles.orderCard}>
                  <Text style={styles.orderHeader}>
                    #{order?.id || stop.label} — Stop {stopNum}
                  </Text>

                  {/* Contact */}
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Phone</Text>
                    <Text style={styles.orderValue}>
                      {order?.contact || "—"}
                    </Text>
                  </View>

                  {/* Address */}
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Address</Text>
                    <Text style={styles.orderValue}>
                      {stop.address}
                    </Text>
                  </View>

                  {/* Items */}
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

                  {/* Total */}
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Total</Text>
                    <Text style={styles.orderValue}>
                      ${order?.total.toFixed(2) || "—"}
                    </Text>
                  </View>

                  {/* Payment */}
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

                  {/* Notes */}
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
          Generated by Ordering System — {new Date().toLocaleDateString("en-AU")}
        </Text>
      </Page>
    </Document>
  );
}
