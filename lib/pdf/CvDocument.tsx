import path from "path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { CvInput } from "@/lib/cv/types";
import type { CvTemplate } from "@/lib/cv/templates";
import { dateRange, contactLine, eduSubLine } from "@/lib/cv/cv-format";

Font.register({
  family: "Roboto",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Regular.ttf") },
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Bold.ttf"), fontWeight: "bold" },
  ],
});

const ACCENT = "#4f46e5";

const s = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 11, color: "#111" },
  pad: { padding: 40 },
  name: { fontSize: 22, fontWeight: "bold" },
  headline: { fontSize: 12, color: "#555", marginBottom: 2 },
  contact: { fontSize: 10, color: "#555", marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginTop: 14, marginBottom: 6, borderBottom: "1 solid #ccc", paddingBottom: 2 },
  itemTitle: { fontWeight: "bold" },
  itemSub: { color: "#555", fontSize: 10, marginBottom: 2 },
  text: { marginBottom: 4, lineHeight: 1.4 },
  skillRow: { marginBottom: 2 },
  modernHeader: { backgroundColor: ACCENT, padding: 28 },
  modernName: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  modernHeadline: { fontSize: 12, color: "#e0e7ff", marginTop: 2 },
  modernContact: { fontSize: 10, color: "#e0e7ff", marginTop: 6 },
  modernBody: { padding: 32, paddingTop: 20 },
  modernSectionTitle: { fontSize: 13, fontWeight: "bold", color: ACCENT, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row" },
  sbLeft: { width: "34%", backgroundColor: "#eef2ff", padding: 20 },
  sbRight: { width: "66%", padding: 24 },
  sbName: { fontSize: 18, fontWeight: "bold" },
  sbHeadline: { fontSize: 11, color: "#555", marginBottom: 8 },
  sbLeftTitle: { fontSize: 11, fontWeight: "bold", color: ACCENT, marginTop: 14, marginBottom: 4 },
  sbLeftText: { fontSize: 10, color: "#333", marginBottom: 3, lineHeight: 1.3 },
  sbRightTitle: { fontSize: 13, fontWeight: "bold", color: ACCENT, marginTop: 12, marginBottom: 6 },
});

function ExperienceItems({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.experiences.map((e, i) => (
        <View key={i} wrap={false} style={{ marginBottom: 6 }}>
          <Text style={s.itemTitle}>{e.position} — {e.company}</Text>
          {dateRange(e.startDate, e.endDate) ? <Text style={s.itemSub}>{dateRange(e.startDate, e.endDate)}</Text> : null}
          {e.description ? <Text style={s.text}>{e.description}</Text> : null}
        </View>
      ))}
    </>
  );
}
function EducationItems({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.educations.map((e, i) => (
        <View key={i} wrap={false} style={{ marginBottom: 6 }}>
          <Text style={s.itemTitle}>{e.school}</Text>
          <Text style={s.itemSub}>{eduSubLine(e.major, dateRange(e.startDate, e.endDate))}</Text>
        </View>
      ))}
    </>
  );
}
function ProjectItems({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.projects.map((pr, i) => (
        <View key={i} wrap={false} style={{ marginBottom: 6 }}>
          <Text style={s.itemTitle}>{pr.name}</Text>
          {pr.tech ? <Text style={s.itemSub}>{pr.tech}</Text> : null}
          {pr.description ? <Text style={s.text}>{pr.description}</Text> : null}
          {pr.link ? <Text style={s.itemSub}>{pr.link}</Text> : null}
        </View>
      ))}
    </>
  );
}
function SkillLines({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.skills.map((sk, i) => (
        <Text key={i} style={s.skillRow}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</Text>
      ))}
    </>
  );
}

function ClassicPage({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <Page style={[s.page, s.pad]}>
      <Text style={s.name}>{p.fullName || "Chưa có tên"}</Text>
      {p.headline ? <Text style={s.headline}>{p.headline}</Text> : null}
      {contact ? <Text style={s.contact}>{contact}</Text> : null}
      {p.summary ? <Text style={s.text}>{p.summary}</Text> : null}
      {cv.experiences.length > 0 && (<View><Text style={s.sectionTitle}>Kinh nghiệm làm việc</Text><ExperienceItems cv={cv} /></View>)}
      {cv.educations.length > 0 && (<View><Text style={s.sectionTitle}>Học vấn</Text><EducationItems cv={cv} /></View>)}
      {cv.skills.length > 0 && (<View><Text style={s.sectionTitle}>Kỹ năng</Text><SkillLines cv={cv} /></View>)}
      {cv.projects.length > 0 && (<View><Text style={s.sectionTitle}>Dự án</Text><ProjectItems cv={cv} /></View>)}
    </Page>
  );
}

function ModernPage({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <Page style={s.page}>
      <View style={s.modernHeader}>
        <Text style={s.modernName}>{p.fullName || "Chưa có tên"}</Text>
        {p.headline ? <Text style={s.modernHeadline}>{p.headline}</Text> : null}
        {contact ? <Text style={s.modernContact}>{contact}</Text> : null}
      </View>
      <View style={s.modernBody}>
        {p.summary ? <Text style={s.text}>{p.summary}</Text> : null}
        {cv.experiences.length > 0 && (<View><Text style={s.modernSectionTitle}>Kinh nghiệm làm việc</Text><ExperienceItems cv={cv} /></View>)}
        {cv.educations.length > 0 && (<View><Text style={s.modernSectionTitle}>Học vấn</Text><EducationItems cv={cv} /></View>)}
        {cv.skills.length > 0 && (<View><Text style={s.modernSectionTitle}>Kỹ năng</Text><SkillLines cv={cv} /></View>)}
        {cv.projects.length > 0 && (<View><Text style={s.modernSectionTitle}>Dự án</Text><ProjectItems cv={cv} /></View>)}
      </View>
    </Page>
  );
}

function SidebarPage({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  return (
    <Page style={s.page}>
      <View style={s.row}>
        <View style={s.sbLeft}>
          <Text style={s.sbName}>{p.fullName || "Chưa có tên"}</Text>
          {p.headline ? <Text style={s.sbHeadline}>{p.headline}</Text> : null}
          <Text style={s.sbLeftTitle}>Liên hệ</Text>
          {p.email ? <Text style={s.sbLeftText}>{p.email}</Text> : null}
          {p.phone ? <Text style={s.sbLeftText}>{p.phone}</Text> : null}
          {cv.skills.length > 0 && (
            <View>
              <Text style={s.sbLeftTitle}>Kỹ năng</Text>
              {cv.skills.map((sk, i) => (
                <Text key={i} style={s.sbLeftText}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</Text>
              ))}
            </View>
          )}
        </View>
        <View style={s.sbRight}>
          {p.summary ? <Text style={s.text}>{p.summary}</Text> : null}
          {cv.experiences.length > 0 && (<View><Text style={s.sbRightTitle}>Kinh nghiệm làm việc</Text><ExperienceItems cv={cv} /></View>)}
          {cv.educations.length > 0 && (<View><Text style={s.sbRightTitle}>Học vấn</Text><EducationItems cv={cv} /></View>)}
          {cv.projects.length > 0 && (<View><Text style={s.sbRightTitle}>Dự án</Text><ProjectItems cv={cv} /></View>)}
        </View>
      </View>
    </Page>
  );
}

export function CvDocument({ cv, template = "classic" }: { cv: CvInput; template?: CvTemplate }) {
  return (
    <Document>
      {template === "modern" ? <ModernPage cv={cv} /> : template === "sidebar" ? <SidebarPage cv={cv} /> : <ClassicPage cv={cv} />}
    </Document>
  );
}
