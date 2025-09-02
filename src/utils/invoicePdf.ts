import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
  due_date?: string | null;
  notes?: string | null;
}

export function generateInvoicePDF(invoice: Invoice, items: InvoiceItem[], format80mm = false) {
  // 80mm thermal printer dimensions (in mm): width ~80mm, variable height
  const pageWidth = format80mm ? 80 : 210; // A4 width is 210mm
  const pageHeight = format80mm ? 297 : 297; // Start with A4 height, will auto-extend for 80mm
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: format80mm ? [80, 297] : 'a4'
  });

  const margin = format80mm ? 5 : 20;
  let yPosition = margin;
  const lineHeight = format80mm ? 4 : 6;
  const fontSize = format80mm ? 8 : 12;
  
  doc.setFontSize(fontSize);

  // Header
  if (format80mm) {
    doc.setFontSize(10);
    doc.text('INVOICE', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += lineHeight * 1.5;
    
    doc.setFontSize(8);
    doc.text(`#${invoice.invoice_number}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += lineHeight;
    
    doc.text(`Date: ${format(new Date(invoice.created_at), 'MMM dd, yyyy')}`, margin, yPosition);
    yPosition += lineHeight;
    
    if (invoice.due_date) {
      doc.text(`Due: ${format(new Date(invoice.due_date), 'MMM dd, yyyy')}`, margin, yPosition);
      yPosition += lineHeight;
    }
    yPosition += lineHeight;
  } else {
    doc.setFontSize(20);
    doc.text('INVOICE', margin, yPosition);
    yPosition += lineHeight * 2;
    
    doc.setFontSize(12);
    doc.text(`Invoice #: ${invoice.invoice_number}`, margin, yPosition);
    yPosition += lineHeight;
    
    doc.text(`Date: ${format(new Date(invoice.created_at), 'MMM dd, yyyy')}`, margin, yPosition);
    yPosition += lineHeight;
    
    if (invoice.due_date) {
      doc.text(`Due Date: ${format(new Date(invoice.due_date), 'MMM dd, yyyy')}`, margin, yPosition);
      yPosition += lineHeight;
    }
    yPosition += lineHeight;
  }

  // Customer Information
  doc.text('Bill To:', margin, yPosition);
  yPosition += lineHeight;
  
  doc.text(invoice.customer_name, margin, yPosition);
  yPosition += lineHeight;
  
  if (invoice.customer_email) {
    doc.text(invoice.customer_email, margin, yPosition);
    yPosition += lineHeight;
  }
  
  if (invoice.customer_phone) {
    doc.text(invoice.customer_phone, margin, yPosition);
    yPosition += lineHeight;
  }
  
  yPosition += lineHeight;

  // Items Header
  if (format80mm) {
    doc.text('Item', margin, yPosition);
    doc.text('Qty', pageWidth - 25, yPosition);
    doc.text('Total', pageWidth - 15, yPosition, { align: 'right' });
    yPosition += lineHeight;
    
    // Draw line
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight / 2;
  } else {
    doc.text('Description', margin, yPosition);
    doc.text('Qty', 120, yPosition);
    doc.text('Price', 140, yPosition);
    doc.text('Total', 170, yPosition);
    yPosition += lineHeight;
    
    // Draw line
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight;
  }

  // Items
  items.forEach((item) => {
    if (format80mm) {
      // Wrap description if too long
      const desc = item.description.length > 20 ? item.description.substring(0, 20) + '...' : item.description;
      doc.text(desc, margin, yPosition);
      doc.text(item.quantity.toString(), pageWidth - 25, yPosition);
      doc.text(item.total_price.toFixed(2), pageWidth - 15, yPosition, { align: 'right' });
      yPosition += lineHeight;
    } else {
      doc.text(item.description, margin, yPosition);
      doc.text(item.quantity.toString(), 120, yPosition);
      doc.text(item.unit_price.toFixed(2), 140, yPosition);
      doc.text(item.total_price.toFixed(2), 170, yPosition);
      yPosition += lineHeight;
    }
  });

  yPosition += lineHeight;

  // Totals
  if (format80mm) {
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight / 2;
    
    doc.text('Subtotal:', margin, yPosition);
    doc.text(invoice.subtotal.toFixed(2), pageWidth - 15, yPosition, { align: 'right' });
    yPosition += lineHeight;
    
    if (invoice.tax_amount > 0) {
      doc.text('Tax:', margin, yPosition);
      doc.text(invoice.tax_amount.toFixed(2), pageWidth - 15, yPosition, { align: 'right' });
      yPosition += lineHeight;
    }
    
    doc.setFontSize(10);
    doc.text('TOTAL:', margin, yPosition);
    doc.text(invoice.total_amount.toFixed(2), pageWidth - 15, yPosition, { align: 'right' });
  } else {
    doc.line(140, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight;
    
    doc.text('Subtotal:', 140, yPosition);
    doc.text(invoice.subtotal.toFixed(2), 170, yPosition);
    yPosition += lineHeight;
    
    if (invoice.tax_amount > 0) {
      doc.text('Tax:', 140, yPosition);
      doc.text(invoice.tax_amount.toFixed(2), 170, yPosition);
      yPosition += lineHeight;
    }
    
    doc.setFontSize(14);
    doc.text('TOTAL:', 140, yPosition);
    doc.text(invoice.total_amount.toFixed(2), 170, yPosition);
  }

  // Notes
  if (invoice.notes) {
    yPosition += lineHeight * 2;
    doc.setFontSize(fontSize);
    doc.text('Notes:', margin, yPosition);
    yPosition += lineHeight;
    
    const notes = doc.splitTextToSize(invoice.notes, pageWidth - (margin * 2));
    doc.text(notes, margin, yPosition);
  }

  return doc;
}

export function downloadInvoicePDF(invoice: Invoice, items: InvoiceItem[], format80mm = false) {
  const doc = generateInvoicePDF(invoice, items, format80mm);
  const filename = `invoice-${invoice.invoice_number}${format80mm ? '-80mm' : ''}.pdf`;
  doc.save(filename);
}