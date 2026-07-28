import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { CvInput } from "@/lib/cv/types";

Font.register({
  family: "Roboto",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Regular.ttf") },
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Bold.ttf"), fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 11, padding: 40, color: "#111" },
  name: { fontSize: 22, fontWeight: "bold" },
  headline: { fontSize: 12, color: "#555", marginBottom: 2 },
  contact: { fontSize: 10, color: "#555", marginBottom: 12 },
  sectionTitle: {
    fontSize: 13, fontWeight: "bold", marginTop: 14, marginBottom: 6,
    borderBottom: "1 solid #ccc", paddingBottom: 2,
  },
  itemTitle: { fontWeight: "bold" },
  itemSub: { color: "#555", fontSize: 10, marginBottom: 2 },
  text: { marginBottom: 4, lineHeight: 1.4 },
  skillRow: { marginBottom: 2 },
});

function dateRange(a: string, b: string): string {
  if (!a && !b) return "";
  return [a, b].filter(Boolean).join(" - ");
}

export function CvDocument({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = [p.email, p.phone].filter(Boolean).join("  •  ");
  return (
    <Document>
      <Page style={s.page}>
        <Text style={s.name}>{p.fullName || "Chưa có tên"}</Text>
        {p.headline ? <Text style={s.headline}>{p.headline}</Text> : null}
        {contact ? <Text style={s.contact}>{contact}</Text> : null}
        {p.summary ? <Text style={s.text}>{p.summary}</Text> : null}

        {cv.experiences.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Kinh nghiệm làm việc</Text>
            {cv.experiences.map((e, i) => (
              <View key={i} wrap={false} style={{ marginBottom: 6 }}>
                <Text style={s.itemTitle}>{e.position} — {e.company}</Text>
                {dateRange(e.startDate, e.endDate) ? (
                  <Text style={s.itemSub}>{dateRange(e.startDate, e.endDate)}</Text>
                ) : null}
                {e.description ? <Text style={s.text}>{e.description}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {cv.educations.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Học vấn</Text>
            {cv.educations.map((e, i) => (
              <View key={i} wrap={false} style={{ marginBottom: 6 }}>
                <Text style={s.itemTitle}>{e.school}</Text>
                <Text style={s.itemSub}>
                  {[e.major, dateRange(e.startDate, e.endDate)].filter(Boolean).join("  •  ")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {cv.skills.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Kỹ năng</Text>
            {cv.skills.map((sk, i) => (
              <Text key={i} style={s.skillRow}>
                • {sk.name}{sk.level ? ` (${sk.level})` : ""}
              </Text>
            ))}
          </View>
        )}

        {cv.projects.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Dự án</Text>
            {cv.projects.map((pr, i) => (
              <View key={i} wrap={false} style={{ marginBottom: 6 }}>
                <Text style={s.itemTitle}>{pr.name}</Text>
                {pr.tech ? <Text style={s.itemSub}>{pr.tech}</Text> : null}
                {pr.description ? <Text style={s.text}>{pr.description}</Text> : null}
                {pr.link ? <Text style={s.itemSub}>{pr.link}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
