/**
 * Sample spectra library. Add entries here for the sample library modal.
 * Structure supports future fields: functionalGroups, thumbnail, etc.
 */
import ethylBenzeneRaw from '../../jdxFiles/100-41-4-IR.jdx?raw'
import methylSalicylateRaw from '../../jdxFiles/119-36-8-IR.jdx?raw'
import ethylAcetateRaw from '../../jdxFiles/141-78-6-IR.jdx?raw'

export const SAMPLE_SPECTRA = [
  {
    id: '100-41-4',
    name: 'Ethylbenzene',
    casNumber: '100-41-4',
    jdxContent: ethylBenzeneRaw,
    // functionalGroups: [],  // for future sorting
    // thumbnail: null,       // for future molecule preview
  },
  {
    id: '119-36-8',
    name: 'Methyl salicylate',
    casNumber: '119-36-8',
    jdxContent: methylSalicylateRaw,
  },
  {
    id: '141-78-6',
    name: 'Ethyl acetate',
    casNumber: '141-78-6',
    jdxContent: ethylAcetateRaw,
  },
]
