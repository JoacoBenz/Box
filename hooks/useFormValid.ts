import { useState, useCallback } from 'react';
import type { FormInstance } from 'antd';

/**
 * Hook that tracks whether an Ant Design form has validation errors.
 * Returns `formProps` to spread on <Form> and `hasErrors` boolean to disable submit buttons.
 *
 * Usage:
 *   const { hasErrors, formProps } = useFormValid(form);
 *   <Form form={form} {...formProps} onFinish={onFinish}>
 *   <Button disabled={hasErrors || loading} htmlType="submit">Submit</Button>
 */
export function useFormValid(form: FormInstance) {
  const [hasErrors, setHasErrors] = useState(false);

  const onFieldsChange = useCallback(() => {
    const errors = form.getFieldsError();
    const hasAny = errors.some(({ errors: errs }) => errs.length > 0);
    setHasErrors(hasAny);
  }, [form]);

  return {
    hasErrors,
    formProps: { onFieldsChange },
  };
}
