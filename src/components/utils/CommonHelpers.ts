import { css } from '@emotion/css';

// Common styles for form components
export const getCommonStyles = () => ({
  container: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  section: css`
    padding: 12px;
    border: 1px solid #555;
    border-radius: 4px;
  `,
  sectionTitle: css`
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 8px;
  `,
  controlRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  `,
  control: css`
    min-width: 120px;
  `,
  buttonGroup: css`
    display: flex;
    gap: 8px;
    margin-top: 8px;
  `,
  objectItem: css`
    padding: 12px;
    border: 1px solid #333;
    border-radius: 4px;
    margin-bottom: 8px;
  `,
  objectHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  `
});

// Common validation helpers
export const validateField = (value: string, required: boolean = false): boolean => {
  if (required && (!value || value.trim() === '')) {
    return false;
  }
  return true;
};

// Common data field creation helper
export const createDefaultDataField = () => ({
  sourceType: 'const' as const,
  value: '0'
});

// Helper to get available field options for dropdowns
export const getFieldOptions = (data?: any) => {
  if (!data || !data.series) return [];
  
  const fieldOptions: Array<{ label: string; value: string }> = [];
  
  data.series.forEach((series: any, seriesIndex: number) => {
    series.fields.forEach((field: any) => {
      if (field.name) {
        const dataSourceName = series.name || series.refId || `Query-${seriesIndex + 1}`;
        const fieldValue = `${dataSourceName}.${field.name}`;
        fieldOptions.push({
          label: `${dataSourceName} → ${field.name}`,
          value: fieldValue
        });
      }
    });
  });
  
  return fieldOptions;
};
