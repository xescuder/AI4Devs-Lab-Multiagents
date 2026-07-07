import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const COLORS = {
  drive: "#3b82f6",
  free: "#22c55e",
  paid: "#f59e0b",
};

function createIcon(emoji, size = 28) {
  return L.divIcon({
    html: `<span style="font-size:${size}px">${emoji}</span>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const driveIcon = createIcon("🚗");
const freeIcon = createIcon("📍");
const paidIcon = createIcon("🎟️");

export default function DayMap({ day }) {
  const points = [];

  (day.drives || []).forEach((d) => {
    if (d.from_lat && d.from_lng) points.push({ lat: d.from_lat, lng: d.from_lng, label: d.from, type: "drive" });
    if (d.to_lat && d.to_lng) points.push({ lat: d.to_lat, lng: d.to_lng, label: d.to, type: "drive" });
  });

  (day.free_activities || []).forEach((a) => {
    if (a.lat && a.lng) points.push({ lat: a.lat, lng: a.lng, label: a.name, type: "free", detail: a.description });
  });

  (day.paid_activities || []).forEach((a) => {
    if (a.lat && a.lng) points.push({ lat: a.lat, lng: a.lng, label: a.name, type: "paid", detail: a.description });
  });

  if (points.length === 0) return null;

  const allLats = points.map((p) => p.lat);
  const allLngs = points.map((p) => p.lng);
  const centerLat = (Math.min(...allLats) + Math.max(...allLats)) / 2;
  const centerLng = (Math.min(...allLngs) + Math.max(...allLngs)) / 2;

  const routeCoords = [];
  (day.drives || []).forEach((d) => {
    if (d.from_lat && d.from_lng) routeCoords.push([d.from_lat, d.from_lng]);
    if (d.to_lat && d.to_lng) routeCoords.push([d.to_lat, d.to_lng]);
  });

  const uniquePoints = [];
  const seen = new Set();
  points.forEach((p) => {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePoints.push(p);
    }
  });

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 h-64">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={7}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
        bounds={uniquePoints.length > 1 ? uniquePoints.map((p) => [p.lat, p.lng]) : undefined}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routeCoords.length > 1 && (
          <Polyline positions={routeCoords} pathOptions={{ color: COLORS.drive, weight: 3, dashArray: "8 4" }} />
        )}

        {uniquePoints.map((p, i) => (
          <Marker
            key={i}
            position={[p.lat, p.lng]}
            icon={p.type === "drive" ? driveIcon : p.type === "free" ? freeIcon : paidIcon}
          >
            <Popup>
              <strong>{p.label}</strong>
              {p.detail && <br />}
              {p.detail && <span className="text-xs">{p.detail}</span>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
