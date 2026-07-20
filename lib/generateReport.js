import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default async function generateReport({
  userName = 'khushji',
  email = 'khushi79916234@gmail.com',
  generatedDate = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  cycles = [],
  pcod = {},
  recentSymptoms = [],
  locale = 'en'
}) {
  const doc = new jsPDF();
  const marginLeft = 20;
  let currentY = 30;

  let fontFamily = 'helvetica';
  const normalFont = 'normal';
  const boldFont = 'bold';
  const italicFont = locale === 'hi' ? 'normal' : 'italic';

  if (locale === 'hi') {
    try {
      const response = await fetch('/fonts/NotoSansDevanagari-Regular.ttf');

      if (response.ok) {
        const buffer = await response.arrayBuffer();

        const base64Font = btoa(
          new Uint8Array(buffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );

        doc.addFileToVFS('NotoSansDevanagari.ttf', base64Font);
        doc.addFont('NotoSansDevanagari.ttf', 'NotoSansDevanagari', 'normal');
        doc.addFont('NotoSansDevanagari.ttf', 'NotoSansDevanagari', 'bold');

        fontFamily = 'NotoSansDevanagari';
        doc.setFont(fontFamily, normalFont);
      }
    } catch (e) {
      console.warn('Could not load Hindi font for PDF', e);
    }
  }

  // Colors
  const brandPink = [194, 59, 122]; // Darker pink for headers
  const lightPink = [253, 235, 242]; // Light pink for table column
  const borderColor = [230, 150, 180];

  // ── HEADER ──
  doc.setFontSize(20);
  doc.setFont(fontFamily, boldFont);
  doc.setTextColor(brandPink[0], brandPink[1], brandPink[2]);
  doc.text('HerCycle AI — Doctor Report', doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
  currentY += 12;

  // ── PATIENT INFO ──
  doc.setFontSize(10);
  doc.setFont(fontFamily, normalFont);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, boldFont);
  doc.text('Patient: ', marginLeft, currentY);
  doc.setFont(fontFamily, normalFont);
  doc.text(userName, marginLeft + 14, currentY);

  doc.setFont(fontFamily, boldFont);
  doc.text('Email: ', marginLeft + 45, currentY);
  doc.setFont(fontFamily, normalFont);
  doc.text(email, marginLeft + 56, currentY);

  currentY += 8;
  doc.text(`Generated: ${generatedDate}`, marginLeft, currentY);
  currentY += 15;

  // ── SECTION 1: CYCLE SUMMARY ──
  doc.setFontSize(14);
  doc.setFont(fontFamily, boldFont);
  doc.setTextColor(brandPink[0], brandPink[1], brandPink[2]);
  doc.text('Cycle Summary', marginLeft, currentY);
  currentY += 6;

  const avgLength = pcod?.averageCycleLength || (cycles.length > 0 ? cycles[0].cycle_length : 28);
  const lastStart = cycles.length > 0 ? (cycles[0].start_date || cycles[0].period_start) : '--';
  const nextPred = pcod?.nextPeriodDate || '--';
  const irregular = pcod?.factors?.some(f => f.toLowerCase().includes('irregular')) ? 'Yes' : 'No';

  autoTable(doc, {
    startY: currentY,
    body: [
      ['Avg cycle length', `${avgLength} days`],
      ['Last period start', lastStart],
      ['Next predicted period', nextPred],
      ['Ovulation (est.)', '--'],
      ['Current phase', 'unknown'],
      ['Irregular cycles', irregular],
      ['Cycles tracked', cycles.length.toString()]
    ],
    theme: 'plain',
    styles: {
      font: fontFamily,
      fontStyle: normalFont,
      lineWidth: 0.1,
      lineColor: borderColor,
      fontSize: 10,
      cellPadding: 3,
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: {
        fillColor: lightPink,
        textColor: brandPink,
        font: fontFamily,
        fontStyle: normalFont,
        cellWidth: 80
      },
      1: {
        fillColor: [255, 255, 255],
        cellWidth: 80
      }
    },
    margin: { left: marginLeft + 10 }
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // ── SECTION 2: RECENT CYCLE HISTORY ──
  doc.setFontSize(12);
  doc.setFont(fontFamily, boldFont);
  doc.setTextColor(brandPink[0], brandPink[1], brandPink[2]);
  doc.text('Recent Cycle History', marginLeft, currentY);
  currentY += 6;

  if (cycles.length === 0) {
    doc.setFontSize(10);
    doc.setFont(fontFamily, normalFont);
    doc.setTextColor(0, 0, 0);
    doc.text('No cycles logged yet.', marginLeft, currentY);
    currentY += 12;
  } else {
    const cycleData = cycles.slice(0, 6).map(c => [
      c.start_date || c.period_start || '--',
      c.end_date || c.period_end || '--',
      c.cycle_length ? `${c.cycle_length} days` : '--'
    ]);
    autoTable(doc, {
      startY: currentY,
      head: [['Start Date', 'End Date', 'Cycle Length']],
      body: cycleData,
      theme: 'plain',
      styles: {
        font: fontFamily,
        fontStyle: normalFont,
        lineWidth: 0.1,
        lineColor: borderColor,
        fontSize: 10
      },
      headStyles: {
        font: fontFamily,
        fontStyle: boldFont,
        fillColor: lightPink,
        textColor: brandPink
      },
      margin: { left: marginLeft }
    });
    currentY = doc.lastAutoTable.finalY + 12;
  }

  // ── SECTION 3: RECENT SYMPTOMS ──
  doc.setFontSize(12);
  doc.setFont(fontFamily, boldFont);
  doc.setTextColor(brandPink[0], brandPink[1], brandPink[2]);
  doc.text('Recent Symptoms (last 15 entries)', marginLeft, currentY);
  currentY += 6;

  if (recentSymptoms.length === 0) {
    doc.setFontSize(10);
    doc.setFont(fontFamily, normalFont);
    doc.setTextColor(0, 0, 0);
    doc.text('No symptom logs yet.', marginLeft, currentY);
    currentY += 15;
  } else {
    // If symptoms exist, format them
    doc.setFontSize(10);
    doc.setFont(fontFamily, normalFont);
    doc.setTextColor(0, 0, 0);
    doc.text(recentSymptoms.join(', '), marginLeft, currentY, { maxWidth: doc.internal.pageSize.getWidth() - 40 });
    currentY += 15;
  }

  // ── FOOTER DISCLAIMER ──
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, italicFont);
  const disclaimer = 'This report is generated by HerCycle AI for informational purposes only and is not a medical diagnosis.';
  doc.text(disclaimer, marginLeft, currentY);

  // Trigger Download
  doc.save('hercycle-report.pdf');
}
