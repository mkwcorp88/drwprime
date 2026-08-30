import { describe, expect, it } from 'vitest';
import {
  buildTreatmentSteps,
  categorizeTreatment,
  makeTreatmentCode,
  parseFeeCsv,
  parseIdr,
  treatmentMappingStatus,
  treatmentProtocolCode,
} from '../../prisma/fee-master-parse';

describe('fee master import', () => {
  it('parses the quoted multi-line header and fee values', () => {
    const text = [
      'NAMA TREATMENT,"FEE PERAWAT /',
      'BEAUTICIAN","INSENTIF',
      'DOKTER"',
      'Acne Facial,10.000,0',
      'Skin Booster Profhilo,5.000,765000',
      'Javanesse Massage 60\',25.000,0',
      '',
    ].join('\n');
    const { rows, errors } = parseFeeCsv(text);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { name: 'Acne Facial', fee: 10000, doctorFee: 0 },
      { name: 'Skin Booster Profhilo', fee: 5000, doctorFee: 765000 },
      { name: "Javanesse Massage 60'", fee: 25000, doctorFee: 0 },
    ]);
  });

  it('reports invalid fee rows and skips empty lines', () => {
    const { rows, errors } = parseFeeCsv('NAMA TREATMENT,FEE,INSENTIF\nGlow Facial,10.000,0\nPeel,abc,0\n');
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Peel');
  });

  it('parses thousands separators and plain digits', () => {
    expect(parseIdr('10.000')).toBe(10000);
    expect(parseIdr('765000')).toBe(765000);
    expect(parseIdr('0')).toBe(0);
    expect(parseIdr('')).toBeNaN();
  });

  it('assigns stable codes and derives categories', () => {
    expect(makeTreatmentCode('Glow Facial (HOME)')).toBe('GLOW-FACIAL-HOME');
    expect(makeTreatmentCode("Crow's Feet Botox")).toBe('CROWS-FEET-BOTOX');
    expect(makeTreatmentCode('Manhwa Lash ')).toBe('MANHWA-LASH');

    expect(categorizeTreatment('Acne Facial')).toBe('Facial');
    expect(categorizeTreatment('Radiance Glow Peel')).toBe('Peel');
    expect(categorizeTreatment('IPL Hair Removal')).toBe('IPL');
    expect(categorizeTreatment('Pico Melasma')).toBe('Pico');
    expect(categorizeTreatment('Dermapen PRP')).toBe('Dermapen');
    expect(categorizeTreatment('Skin Booster Rejuran Healer')).toBe('Skin Booster');
    expect(categorizeTreatment('Botox Forehead')).toBe('Botox');
    expect(categorizeTreatment('PRP Injection')).toBe('Injection');
    expect(categorizeTreatment('Cauter')).toBe('Tindakan Medis');
    expect(categorizeTreatment('Hair SPA Mint Long')).toBe('Hair');
    expect(categorizeTreatment('Nail Gel 3D')).toBe('Nail');
    expect(categorizeTreatment('Natural Lash')).toBe('Lash');
    expect(categorizeTreatment('Body SPA')).toBe('Body & Spa');
    expect(categorizeTreatment('Glow Facial (HOME)')).toBe('Home Treatment');
    expect(categorizeTreatment('Subsisi')).toBe('Lainnya');
  });

  it('builds a therapist step and an optional doctor step', () => {
    expect(buildTreatmentSteps({ name: 'Acne Facial', fee: 10000, doctorFee: 0 })).toEqual([{
      actionName: 'Pelaksanaan treatment', sequenceNumber: 1, isRequired: true,
      requiredRole: 'THERAPIST', incentiveType: 'FIXED', incentiveValue: 10000,
    }]);

    const withDoctor = buildTreatmentSteps({ name: 'IPL Glow', fee: 5000, doctorFee: 25000 });
    expect(withDoctor).toHaveLength(2);
    expect(withDoctor[1]).toMatchObject({
      actionName: 'Tindakan dokter', sequenceNumber: 2, isRequired: false,
      requiredRole: 'DOCTOR', incentiveType: 'FIXED', incentiveValue: 25000,
    });
  });

  it('maps only confirmed exact names to protocols and keeps others pending', () => {
    expect(treatmentMappingStatus('Dermapen PRP')).toBe('EXACT_NAME');
    expect(treatmentProtocolCode('Dermapen PRP')).toBe('PRT-DERMA-PRP');
    expect(treatmentMappingStatus('Dermapen DNA Salmon')).toBe('EXACT_NAME');
    expect(treatmentProtocolCode('Dermapen DNA Salmon')).toBe('PRT-DERMA-DNA-MELASMA');
    expect(treatmentMappingStatus('Dermapen Melasma')).toBe('EXACT_NAME');
    expect(treatmentProtocolCode('Dermapen Melasma')).toBe('PRT-DERMA-DNA-MELASMA');

    expect(treatmentMappingStatus('Acne Facial')).toBe('PENDING_CONFIRMATION');
    expect(treatmentProtocolCode('Acne Facial')).toBeNull();
    expect(treatmentMappingStatus('Glow Facial (HOME)')).toBe('PENDING_CONFIRMATION');
  });
});
