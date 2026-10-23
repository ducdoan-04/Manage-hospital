import { useState } from 'react';
import { PatientBanner } from './components/patientBanner';
import { EmarControls } from './components/emarControls';
import { MedicationTable } from './components/medicationTable';

export const EmarPage = () => {
  const [currentDate] = useState(
    new Date().toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Dùng thuốc Điện tử (eMAR)</h1>
          <p className="text-sm text-slate-500 mt-0.5">Theo dõi thời gian dùng thuốc, y lệnh bác sĩ và đối chiếu an toàn người bệnh</p>
        </div>
      </div>
      
      <PatientBanner />
      <EmarControls currentDate={currentDate} />
      <MedicationTable />
    </div>
  );
};

