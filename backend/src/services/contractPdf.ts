import PDFDocument from 'pdfkit';

export interface ContractData {
  bookingId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  vehicleLabel: string;
  plateNumber: string;
  rentalType: string;
  startDate: string;
  endDate: string;
  pickupRegion: string;
  dropoffRegion: string;
  quotedCurrency: string;
  quotedAmount: number;
}

export function buildContractPdf(data: ContractData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Vehicle Rental Agreement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#555').text(`Booking Reference: ${data.bookingId}`, { align: 'center' });
    doc.moveDown(2);

    doc.fillColor('#000').fontSize(13).text('Renter Details');
    doc.fontSize(11).fillColor('#333');
    doc.text(`Name: ${data.clientName}`);
    doc.text(`Phone: ${data.clientPhone}`);
    doc.text(`Email: ${data.clientEmail}`);
    doc.moveDown();

    doc.fillColor('#000').fontSize(13).text('Vehicle Details');
    doc.fontSize(11).fillColor('#333');
    doc.text(`Vehicle: ${data.vehicleLabel}`);
    doc.text(`Plate Number: ${data.plateNumber}`);
    doc.text(`Rental Type: ${data.rentalType === 'driver_included' ? 'With Driver' : 'Self-Drive'}`);
    doc.moveDown();

    doc.fillColor('#000').fontSize(13).text('Rental Period');
    doc.fontSize(11).fillColor('#333');
    doc.text(`Start Date: ${data.startDate}`);
    doc.text(`End Date: ${data.endDate}`);
    doc.text(`Pickup Region: ${data.pickupRegion}`);
    doc.text(`Drop-off Region: ${data.dropoffRegion}`);
    if (data.pickupRegion.trim().toLowerCase() !== data.dropoffRegion.trim().toLowerCase()) {
      doc.fillColor('#8a7a4d').text('Note: This is a cross-region rental.');
      doc.fillColor('#333');
    }
    doc.moveDown();

    doc.fillColor('#000').fontSize(13).text('Charges');
    doc.fontSize(11).fillColor('#333');
    doc.text(`Quoted Amount: ${data.quotedAmount.toLocaleString()} ${data.quotedCurrency}`);
    doc.moveDown(3);

    doc.fontSize(10).fillColor('#555').text(
      'By signing below, the renter agrees to the terms of this rental agreement, including responsibility ' +
      'for the vehicle during the rental period, fuel policy, and any applicable deposit terms.',
      { align: 'left' }
    );
    doc.moveDown(3);

    doc.text('Renter Signature: ______________________________', { continued: false });
    doc.moveDown();
    doc.text('Date: ______________________________');

    doc.end();
  });
}
