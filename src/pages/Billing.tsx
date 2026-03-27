import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserScope } from '@/hooks/useUserScope';

import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Save, Plus, Trash2, Receipt as ReceiptIcon, Loader2, Lock, DollarSign, AlertTriangle } from 'lucide-react';
import { sendNotification } from '@/lib/notifications';
import { Invoice, Receipt, Preset } from '@/types';
import { format } from 'date-fns';
import { useRelationalNav } from '@/hooks/useRelationalNav';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

interface LineItem {
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  disc_pct: number;
  gst_pct: number;
}

interface Expense {
  id: string;
  vendor_name: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  is_billable: boolean;
  notes: string;
  created_at: string;
}

const emptyItem = (): LineItem => ({ description: '', hsn: '9993', qty: 1, rate: 0, disc_pct: 0, gst_pct: 18 });

const numberToWords = (n: number): string => {
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convert(num % 10000000) : '');
  };
  const whole = Math.floor(Math.abs(n));
  const paise = Math.round((Math.abs(n) - whole) * 100);
  let result = convert(whole);
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
};

export default function Billing() {
  const { invoiceId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isAdmin, canAccessPatient } = useUserScope();
  const navigate = useNavigate();
  const { openPreview } = useRelationalNav();
  const isNew = !invoiceId;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [allPresets, setAllPresets] = useState<Preset[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [rightTab, setRightTab] = useState('payments');

  // Invoice state
  const [status, setStatus] = useState<string>('draft');
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [merchantDetails, setMerchantDetails] = useState({ name: '', email: '', address: '', bank_details: '' });
  const [clientDetails, setClientDetails] = useState({ name: '', email: '', address: '' });
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [caseRequestId, setCaseRequestId] = useState<string | null>(null);
  const [primaryUserId, setPrimaryUserId] = useState<string | null>(null);
  const [secondaryUserIds, setSecondaryUserIds] = useState<string[]>([]);

  // Receipt form
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [receiptMethod, setReceiptMethod] = useState('cash');
  const [receiptRef, setReceiptRef] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');

  // Expense form
  const [expVendor, setExpVendor] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('general');
  const [expBillable, setExpBillable] = useState(false);
  const [expNotes, setExpNotes] = useState('');

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<{ id: string; patient_name: string; doctor_name: string | null; clinic_name: string | null }[]>([]);
  const [patientSearchFocused, setPatientSearchFocused] = useState(false);

  // Phase/Plan data for selected patient
  const [patientPhases, setPatientPhases] = useState<{ id: string; phase_name: string }[]>([]);
  const [patientPlans, setPatientPlans] = useState<{ id: string; plan_name: string; phase_id: string }[]>([]);
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  // User assignment
  const [allProfiles, setAllProfiles] = useState<{ user_id: string; display_name: string | null }[]>([]);

  useEffect(() => {
    supabase.from('presets').select('*').order('name').then(({ data }) => {
      const all = (data || []) as unknown as Preset[];
      setAllPresets(all);
      setPresets(all.filter(p => p.category === 'fee' || p.category === 'item' || p.category === 'fee_item'));
    });
    if (isAdmin) {
      supabase.from('profiles').select('user_id, display_name').then(({ data }) => setAllProfiles(data || []));
    }

    // Pre-fill from query params (bill from phase/plan)
    const prefillPatientId = searchParams.get('patientId');
    const prefillPatientName = searchParams.get('patientName');
    const prefillPhaseId = searchParams.get('phaseId');
    if (prefillPatientId) setPatientId(prefillPatientId);
    if (prefillPatientName) {
      setPatientName(prefillPatientName);
      setClientDetails(prev => ({ ...prev, name: prefillPatientName }));
    }
    if (prefillPhaseId) setPhaseId(prefillPhaseId);

    if (!isNew && invoiceId) {
      Promise.all([
        supabase.from('invoices').select('*').eq('id', invoiceId).single(),
        supabase.from('receipts').select('*').eq('invoice_id', invoiceId).order('payment_date'),
        supabase.from('expenses').select('*').eq('invoice_id', invoiceId).eq('is_deleted', false).order('created_at'),
      ]).then(([{ data: inv }, { data: recs }, { data: exps }]) => {
        if (inv) {
          setStatus(inv.status);
          setPatientName(inv.patient_name);
          setPatientId(inv.patient_id);
          setPhaseId(inv.phase_id);
          setInvoiceNumber(inv.invoice_number || '');
          setInvoiceDate(inv.created_at ? format(new Date(inv.created_at), 'yyyy-MM-dd') : '');
          setDueDate(inv.due_date || '');
          setPlaceOfSupply(inv.place_of_supply || '');
          setGstNumber(inv.gst_number || '');
          setCurrency((inv as any).currency || inv.currency_local || 'INR');
          setMerchantDetails((inv.merchant_details as any) || { name: '', email: '', address: '', bank_details: '' });
          setClientDetails((inv.client_details as any) || { name: '', email: '', address: '' });
          setItems((inv.items as any as LineItem[]) || [emptyItem()]);
          setCaseRequestId(inv.case_request_id);
          setPrimaryUserId(inv.primary_user_id);
          setSecondaryUserIds(inv.secondary_user_ids || []);
          setIsLocked((inv as any).is_locked || false);
        }
        setReceipts((recs || []) as unknown as Receipt[]);
        setExpenses((exps || []) as unknown as Expense[]);
        setLoading(false);
      });
    } else {
      supabase.from('invoices').select('invoice_number').like('invoice_number', `INV-${new Date().getFullYear()}-%`).order('invoice_number', { ascending: false }).limit(1)
        .then(({ data }) => {
          const last = data?.[0]?.invoice_number;
          const num = last ? parseInt(last.split('-').pop() || '0') + 1 : 1;
          setInvoiceNumber(`INV-${new Date().getFullYear()}-${String(num).padStart(4, '0')}`);
          const due = new Date();
          due.setDate(due.getDate() + 30);
          setDueDate(format(due, 'yyyy-MM-dd'));
        });
    }
  }, [invoiceId, isNew, searchParams]);

  // Patient search (RBAC-scoped)
  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('patients').select('id, patient_name, doctor_name, clinic_name, lab_name, company_name, user_id, primary_user_id, secondary_user_id')
        .ilike('patient_name', `%${patientSearch}%`).limit(20);
      const results = (data || []).filter(p => canAccessPatient(p));
      setPatientResults(results.slice(0, 5));
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch, canAccessPatient]);

  const selectPatient = async (p: typeof patientResults[0]) => {
    setPatientId(p.id);
    setPatientName(p.patient_name);
    setPatientSearch('');
    setPatientResults([]);

    // Auto-populate primary/secondary user from patient record
    const { data: patientFull } = await supabase.from('patients').select('primary_user_id, secondary_user_id, clinic_name, doctor_name, lab_name').eq('id', p.id).single();
    if (patientFull) {
      if (patientFull.primary_user_id) setPrimaryUserId(patientFull.primary_user_id);
      if (patientFull.secondary_user_id) setSecondaryUserIds([patientFull.secondary_user_id]);
    }

    // Auto-populate client details from clinic/doctor CRM entity
    const clinicEntity = p.clinic_name ? (await supabase.from('settings_entities').select('*').eq('entity_name', p.clinic_name).eq('entity_type', 'clinic').single()).data : null;
    const doctorEntity = p.doctor_name ? (await supabase.from('settings_entities').select('*').eq('entity_name', p.doctor_name).eq('entity_type', 'doctor').single()).data : null;
    const labEntity = patientFull?.lab_name ? (await supabase.from('settings_entities').select('*').eq('entity_name', patientFull.lab_name).eq('entity_type', 'lab').single()).data : null;

    // Build client details from clinic/doctor entity
    const clientEntity = clinicEntity || doctorEntity;
    const clientAddr = clientEntity
      ? [clientEntity.address, clientEntity.city, clientEntity.state, clientEntity.country].filter(Boolean).join(', ')
      : [p.clinic_name, p.doctor_name].filter(Boolean).join(' • ');

    setClientDetails({
      name: p.patient_name,
      email: (clientEntity as any)?.email || '',
      address: clientAddr,
    });

    // Auto-fill GST from client entity
    if ((clientEntity as any)?.gst_number) {
      setGstNumber((clientEntity as any).gst_number);
    }
    if ((clientEntity as any)?.state) {
      setPlaceOfSupply((clientEntity as any).state);
    }

    // Auto-populate merchant details from lab entity (the lab doing the work)
    if (labEntity) {
      const labAddr = [labEntity.address, labEntity.city, labEntity.state, labEntity.country].filter(Boolean).join(', ');
      setMerchantDetails(prev => ({
        ...prev,
        name: (labEntity as any).entity_name || prev.name,
        email: (labEntity as any).email || prev.email,
        address: labAddr || prev.address,
      }));
    }

    // Fetch phases and plans for the patient
    const { data: phasesData } = await supabase.from('phases').select('id, phase_name').eq('patient_id', p.id).order('phase_order');
    setPatientPhases(phasesData || []);
    if (phasesData && phasesData.length > 0) {
      setPhaseId(phasesData[0].id);
      const { data: plansData } = await supabase.from('treatment_plans').select('id, plan_name, phase_id, case_request_id').in('phase_id', phasesData.map(d => d.id));
      setPatientPlans((plansData || []) as any);

      // Auto-populate line items from linked case request's request type
      if (isNew) {
        // Try from plan's case_request_id first, then from patient's case_requests
        let caseReqType: string | null = null;
        let caseReqId: string | null = null;
        if (plansData && plansData.length > 0) {
          const planWithRequest = plansData.find((pl: any) => pl.case_request_id);
          if (planWithRequest) {
            caseReqId = (planWithRequest as any).case_request_id;
            const { data: caseReq } = await supabase.from('case_requests').select('request_type').eq('id', caseReqId!).single();
            if (caseReq) caseReqType = caseReq.request_type;
          }
        }
        // Fallback: look up case_requests by patient_id
        if (!caseReqType) {
          const { data: patientCases } = await supabase.from('case_requests').select('id, request_type').eq('patient_id', p.id).eq('is_deleted', false).limit(1);
          if (patientCases && patientCases.length > 0) {
            caseReqType = patientCases[0].request_type;
            caseReqId = patientCases[0].id;
          }
        }
        if (caseReqType) {
          const reqTypePreset = allPresets.find(pr => pr.category === 'request_type' && pr.name === caseReqType);
          if (reqTypePreset) {
            setItems([{
              description: reqTypePreset.name,
              hsn: '9993',
              qty: 1,
              rate: reqTypePreset.unit_price || reqTypePreset.fee_usd || 0,
              disc_pct: 0,
              gst_pct: reqTypePreset.tax_rate || 18,
            }]);
            if (caseReqId) setCaseRequestId(caseReqId);
          }
        }
      }
    }
  };

  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || currency;

  // Calculations
  const totals = useMemo(() => {
    let subtotal = 0, totalDiscount = 0, totalTax = 0;
    items.forEach(item => {
      const lineTotal = item.qty * item.rate;
      const disc = lineTotal * (item.disc_pct / 100);
      const taxable = lineTotal - disc;
      const tax = taxable * (item.gst_pct / 100);
      subtotal += lineTotal;
      totalDiscount += disc;
      totalTax += tax;
    });
    const taxableAmount = subtotal - totalDiscount;
    const grandTotal = taxableAmount + totalTax;
    return { subtotal, totalDiscount, taxableAmount, totalTax, grandTotal };
  }, [items]);

  const totalPaid = receipts.reduce((s, r) => s + r.amount, 0);
  const balanceDue = totals.grandTotal - totalPaid;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, j) => j !== i));
  const updateItem = (i: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((item, j) => j === i ? { ...item, [field]: value } : item));
  };

  const applyPreset = (preset: Preset) => {
    setItems(prev => [...prev, {
      description: preset.name, hsn: '9993', qty: 1,
      rate: preset.unit_price || preset.fee_usd || 0, disc_pct: 0,
      gst_pct: preset.tax_rate || 18,
    }]);
  };

  const saveInvoice = async (newStatus?: string) => {
    if (!isAdmin) { toast.error('Only admin can edit invoices'); return; }
    if (!user || !patientName) { toast.error('Patient name required'); return; }
    if (!placeOfSupply) { toast.error('Place of Supply is required'); return; }
    if (isLocked) { toast.error('This invoice is locked (paid). Cannot edit.'); return; }
    setSaving(true);
    const finalStatus = newStatus || status;
    const payload = {
      patient_name: patientName,
      patient_id: patientId,
      phase_id: phaseId,
      user_id: user.id,
      status: finalStatus,
      amount_usd: totals.grandTotal,
      items: items as any,
      merchant_details: merchantDetails as any,
      client_details: clientDetails as any,
      invoice_number: invoiceNumber,
      display_id: invoiceNumber,
      due_date: dueDate || null,
      place_of_supply: placeOfSupply,
      gst_number: gstNumber || null,
      hsn_code: '9993',
      case_request_id: caseRequestId,
      balance_due: balanceDue,
      currency_local: currency,
      exchange_rate: 1,
      primary_user_id: primaryUserId,
      secondary_user_ids: secondaryUserIds.length > 0 ? secondaryUserIds : null,
    };

    try {
      if (isNew) {
        const { data, error } = await supabase.from('invoices').insert(payload).select('id').single();
        if (error) throw error;
        toast.success(finalStatus === 'sent' ? 'Invoice saved & published' : 'Invoice created');
        // Notify patient owner when invoice is sent
        if (finalStatus === 'sent' && primaryUserId && user && primaryUserId !== user.id) {
          sendNotification({
            userId: primaryUserId,
            eventType: 'invoice_sent',
            placeholders: { patient_name: patientName, invoice_number: invoiceNumber, invoice_amount: `${currencySymbol}${totals.grandTotal.toFixed(2)}` },
            link: `/billing/${data.id}`,
          });
        }
        navigate(`/billing/${data.id}`);
      } else {
        const { error } = await supabase.from('invoices').update(payload).eq('id', invoiceId);
        if (error) throw error;
        setStatus(finalStatus);
        // Notify on status change to 'sent'
        if (finalStatus === 'sent' && status !== 'sent' && primaryUserId && user && primaryUserId !== user.id) {
          sendNotification({
            userId: primaryUserId,
            eventType: 'invoice_sent',
            placeholders: { patient_name: patientName, invoice_number: invoiceNumber, invoice_amount: `${currencySymbol}${totals.grandTotal.toFixed(2)}` },
            link: `/billing/${invoiceId}`,
          });
        }
        toast.success(finalStatus === 'sent' ? 'Invoice updated & published' : 'Invoice saved');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const recordReceipt = async () => {
    if (!invoiceId || !receiptAmount) return;
    const amount = parseFloat(receiptAmount);
    if (amount <= 0) { toast.error('Amount must be greater than 0'); return; }
    const { data, error } = await supabase.from('receipts').insert({
      invoice_id: invoiceId, amount, payment_date: receiptDate,
      payment_method: receiptMethod, reference_number: receiptRef || null, notes: receiptNotes || null,
    }).select().single();

    if (!error && data) {
      setReceipts(prev => [...prev, data as unknown as Receipt]);
      const newTotalPaid = totalPaid + amount;
      const newBalance = totals.grandTotal - newTotalPaid;

      let newStatus = status;
      if (newBalance <= 0) newStatus = 'paid';
      else if (newTotalPaid > 0) newStatus = 'partially_paid';

      // Lock invoice when fully paid
      const shouldLock = newBalance <= 0;
      setStatus(newStatus);
      setIsLocked(shouldLock);
      await supabase.from('invoices').update({
        status: newStatus,
        balance_due: Math.max(newBalance, 0),
        is_locked: shouldLock,
      } as any).eq('id', invoiceId);

      // Notify patient owner about payment
      if (primaryUserId && user && primaryUserId !== user.id) {
        sendNotification({
          userId: primaryUserId,
          eventType: 'payment_received',
          placeholders: { patient_name: patientName, invoice_number: invoiceNumber, payment_amount: `${currencySymbol}${amount.toFixed(2)}`, balance_due: `${currencySymbol}${Math.max(newBalance, 0).toFixed(2)}` },
          link: `/billing/${invoiceId}`,
        });
      }

      setShowReceiptForm(false);
      setReceiptAmount(''); setReceiptRef(''); setReceiptNotes('');

      if (newBalance < 0) {
        toast.success(`Payment recorded. Credit of ${currencySymbol}${Math.abs(newBalance).toFixed(2)}.`);
      } else if (newBalance === 0) {
        toast.success('Payment recorded. Invoice fully paid & locked!');
      } else {
        toast.success(`Payment recorded. Balance: ${currencySymbol}${newBalance.toFixed(2)}`);
      }
    }
  };

  const addExpense = async () => {
    if (!invoiceId || !expDesc) return;
    const { data, error } = await supabase.from('expenses').insert({
      invoice_id: invoiceId, patient_id: patientId, user_id: user!.id,
      vendor_name: expVendor, description: expDesc,
      amount: parseFloat(expAmount) || 0, currency,
      category: expCategory, is_billable: expBillable, notes: expNotes || null,
    } as any).select().single();
    if (!error && data) {
      setExpenses(prev => [...prev, data as unknown as Expense]);
      setShowExpenseForm(false);
      setExpVendor(''); setExpDesc(''); setExpAmount(''); setExpNotes('');
      toast.success('Expense recorded');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  const isEditable = !isLocked && isAdmin;

  return (
    <div className="min-h-screen bg-background">
      <Header title={isNew ? 'New Invoice' : `Invoice ${invoiceNumber}`} leftActions={
        <Button variant="ghost" size="icon" onClick={() => navigate('/billing')}><ArrowLeft className="w-4 h-4" /></Button>
      } />
      <main className="container mx-auto px-4 py-6">
        {/* Lock banner */}
        {isLocked && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 text-sm">
            <Lock className="w-4 h-4 text-yellow-600" />
            <span className="text-yellow-800 dark:text-yellow-400 font-medium">This invoice is locked (paid with receipts). It cannot be edited.</span>
          </div>
        )}

        {/* Top action bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-lg font-bold">{invoiceNumber || 'New'}</span>
            {isEditable ? (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline">{status.replace('_', ' ')}</Badge>
            )}
            {patientId && (
              <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => openPreview('patient', patientId!)}>
                👤 {patientName}
              </Badge>
            )}
            {isLocked && <Lock className="w-4 h-4 text-yellow-500" />}
          </div>
          <div className="flex gap-2">
            {isEditable && (
              <>
                <Button variant="outline" size="sm" onClick={() => saveInvoice()} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Save Draft
                </Button>
                <Button size="sm" onClick={() => saveInvoice('sent')} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Save & Publish
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-3 h-3 mr-1" /> Print
            </Button>
            {isAdmin && !isNew && (
              <Button variant="destructive" size="sm" onClick={async () => {
                if (!confirm('Delete this invoice? It will be moved to Archives.')) return;
                await supabase.from('invoices').update({ is_deleted: true }).eq('id', invoiceId);
                toast.success('Invoice deleted (moved to archives)');
                navigate('/billing');
              }}>
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Invoice editor (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Patient / Client */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Client Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Label className="text-xs">Patient Name *</Label>
                  <Input
                    value={patientName}
                    onChange={e => { if (!isEditable) return; setPatientName(e.target.value); setPatientSearch(e.target.value); }}
                    placeholder="Search or type patient name..."
                    disabled={!isEditable}
                    onFocus={() => setPatientSearchFocused(true)}
                    onBlur={() => setTimeout(() => setPatientSearchFocused(false), 200)}
                  />
                  {patientSearchFocused && patientSearch.length >= 2 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {patientResults.length > 0 ? patientResults.map(p => (
                        <div key={p.id} className="px-3 py-2 text-sm hover:bg-accent cursor-pointer" onClick={() => selectPatient(p)}>
                          <span className="font-medium">{p.patient_name}</span>
                          {p.doctor_name && <span className="text-muted-foreground"> • {p.doctor_name}</span>}
                          {p.clinic_name && <span className="text-muted-foreground text-xs"> • {p.clinic_name}</span>}
                        </div>
                      )) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No patients found</div>
                      )}
                    </div>
                  )}
                </div>
                {/* Phase/Plan selector */}
                {patientId && patientPhases.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <div>
                      <Label className="text-xs">Phase</Label>
                      <Select value={phaseId || '__none__'} onValueChange={v => setPhaseId(v === '__none__' ? null : v)} disabled={!isEditable}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select phase..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {patientPhases.map(ph => <SelectItem key={ph.id} value={ph.id}>{ph.phase_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {phaseId && patientPlans.filter(p => p.phase_id === phaseId).length > 0 && (
                      <div>
                        <Label className="text-xs">Plan (for reference)</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patientPlans.filter(p => p.phase_id === phaseId).map(pl => (
                            <Badge key={pl.id} variant="outline" className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => openPreview('plan', pl.id)}>
                              {pl.plan_name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Email</Label><Input value={clientDetails.email} onChange={e => setClientDetails(p => ({ ...p, email: e.target.value }))} disabled={!isEditable} /></div>
                  <div><Label className="text-xs">Address</Label><Input value={clientDetails.address || ''} onChange={e => setClientDetails(p => ({ ...p, address: e.target.value }))} disabled={!isEditable} /></div>
                </div>
                {/* Assign to users */}
                {isAdmin && allProfiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <div>
                      <Label className="text-xs">Assign Primary User</Label>
                      <Select value={primaryUserId || '__none__'} onValueChange={v => setPrimaryUserId(v === '__none__' ? null : v)} disabled={!isEditable}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {allProfiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.user_id.slice(0, 8)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Secondary Users</Label>
                      <Select value="__add__" onValueChange={v => { if (v !== '__add__' && !secondaryUserIds.includes(v)) setSecondaryUserIds(prev => [...prev, v]); }} disabled={!isEditable}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Add user..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__add__">Add user...</SelectItem>
                          {allProfiles.filter(p => !secondaryUserIds.includes(p.user_id)).map(p => (
                            <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.user_id.slice(0, 8)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {secondaryUserIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {secondaryUserIds.map(uid => (
                            <Badge key={uid} variant="secondary" className="text-[10px] gap-1">
                              {allProfiles.find(p => p.user_id === uid)?.display_name || uid.slice(0, 8)}
                              {isEditable && <button onClick={() => setSecondaryUserIds(prev => prev.filter(x => x !== uid))} className="ml-0.5 hover:text-destructive">×</button>}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoice meta */}
            <Card>
              <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div><Label className="text-xs">Invoice Date</Label><Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} disabled={!isEditable} /></div>
                <div><Label className="text-xs">Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={!isEditable} /></div>
                <div>
                  <Label className="text-xs">Place of Supply *</Label>
                  <Input value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)} placeholder="e.g. Maharashtra, Dubai" disabled={!isEditable} />
                </div>
                <div><Label className="text-xs">GST Number</Label><Input value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="GSTIN" disabled={!isEditable} /></div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={!isEditable}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Line items */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Line Items</CardTitle>
                {isEditable && presets.length > 0 && (
                  <Select onValueChange={v => { const p = presets.find(x => x.id === v); if (p) applyPreset(p); }}>
                    <SelectTrigger className="h-7 text-[10px] w-28"><SelectValue placeholder="Apply Preset" /></SelectTrigger>
                    <SelectContent>{presets.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  <div className="col-span-4">Description</div>
                  <div>HSN</div><div>Qty</div><div>Rate</div><div>Disc%</div><div>GST%</div>
                  <div className="col-span-2 text-right">Amount</div><div></div>
                </div>
                {items.map((item, i) => {
                  const lineAmt = item.qty * item.rate;
                  const disc = lineAmt * (item.disc_pct / 100);
                  const amt = lineAmt - disc;
                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-4">
                        <Input className="h-8 text-xs" placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} disabled={!isEditable} />
                      </div>
                      <Input className="h-8 text-xs hidden sm:block" value={item.hsn} onChange={e => updateItem(i, 'hsn', e.target.value)} disabled={!isEditable} />
                      <Input className="h-8 text-xs" type="number" value={item.qty} onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)} disabled={!isEditable} />
                      <Input className="h-8 text-xs" type="number" value={item.rate} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} disabled={!isEditable} />
                      <Input className="h-8 text-xs hidden sm:block" type="number" value={item.disc_pct} onChange={e => updateItem(i, 'disc_pct', parseFloat(e.target.value) || 0)} disabled={!isEditable} />
                      <Input className="h-8 text-xs hidden sm:block" type="number" value={item.gst_pct} onChange={e => updateItem(i, 'gst_pct', parseFloat(e.target.value) || 0)} disabled={!isEditable} />
                      <div className="col-span-2 text-right text-sm font-medium">{currencySymbol}{amt.toFixed(2)}</div>
                      {isEditable && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
                    </div>
                  );
                })}
                {isEditable && (
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="text-xs" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Add Item</Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowPresetPicker(!showPresetPicker)}>
                      <DollarSign className="w-3 h-3 mr-1" /> Add from Presets
                    </Button>
                  </div>
                )}
                {showPresetPicker && (
                  <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Select preset items to add:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {allPresets.filter(p => ['fee', 'item', 'fee_item', 'request_type'].includes(p.category)).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded border border-border/50 hover:bg-accent/50 cursor-pointer text-xs"
                          onClick={() => {
                            applyPreset(p);
                            toast.success(`Added: ${p.name}`);
                          }}>
                          <span className="font-medium truncate">{p.name}</span>
                          <span className="text-muted-foreground shrink-0">{currencySymbol}{p.unit_price || p.fee_usd || 0}</span>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowPresetPicker(false)}>Close</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Totals */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{currencySymbol}{totals.subtotal.toFixed(2)}</span></div>
                {totals.totalDiscount > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="text-destructive">-{currencySymbol}{totals.totalDiscount.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Taxable Amount</span><span>{currencySymbol}{totals.taxableAmount.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST</span><span>{currencySymbol}{totals.totalTax.toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span>Grand Total</span><span>{currencySymbol}{totals.grandTotal.toFixed(2)}</span></div>
                {currency === 'INR' && <p className="text-[10px] text-muted-foreground italic">{numberToWords(totals.grandTotal)}</p>}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Payments + Expenses sidebar */}
          <div className="space-y-4">
            <Tabs value={rightTab} onValueChange={setRightTab}>
              <TabsList className="w-full">
                <TabsTrigger value="payments" className="text-xs flex-1">Payments</TabsTrigger>
                {isAdmin && <TabsTrigger value="expenses" className="text-xs flex-1">Expenses</TabsTrigger>}
              </TabsList>

              <TabsContent value="payments" className="mt-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className={`text-center p-3 rounded-lg ${balanceDue > 0 ? 'bg-destructive/10' : balanceDue < 0 ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
                      <p className="text-xs text-muted-foreground">{balanceDue < 0 ? 'Credit Balance' : 'Balance Due'}</p>
                      <p className={`text-xl font-bold ${balanceDue > 0 ? 'text-destructive' : balanceDue < 0 ? 'text-blue-600' : 'text-green-600'}`}>
                        {balanceDue < 0 ? `${currencySymbol}${Math.abs(balanceDue).toFixed(2)} credit` : `${currencySymbol}${balanceDue.toFixed(2)}`}
                      </p>
                    </div>

                    {receipts.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                        <div>
                          <p className="font-medium">{currencySymbol}{r.amount.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">{format(new Date(r.payment_date), 'MMM d, yyyy')} • {r.payment_method}</p>
                        </div>
                        {r.reference_number && <span className="text-[10px] text-muted-foreground font-mono">{r.reference_number}</span>}
                      </div>
                    ))}

                    {!isNew && !showReceiptForm && isAdmin && (
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setShowReceiptForm(true); setReceiptAmount(String(balanceDue > 0 ? balanceDue.toFixed(2) : '')); }}>
                        <Plus className="w-3 h-3 mr-1" /> Record Payment
                      </Button>
                    )}

                    {showReceiptForm && (
                      <div className="space-y-2 border rounded-lg p-3">
                        <div><Label className="text-xs">Amount</Label><Input type="number" value={receiptAmount} onChange={e => setReceiptAmount(e.target.value)} /></div>
                        <div><Label className="text-xs">Date</Label><Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} /></div>
                        <div>
                          <Label className="text-xs">Method</Label>
                          <Select value={receiptMethod} onValueChange={setReceiptMethod}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="upi">UPI</SelectItem>
                              <SelectItem value="neft">NEFT/RTGS</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="wire">Wire Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">Reference #</Label><Input value={receiptRef} onChange={e => setReceiptRef(e.target.value)} placeholder="Txn ID / Cheque #" /></div>
                        <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={receiptNotes} onChange={e => setReceiptNotes(e.target.value)} /></div>
                        <div className="flex gap-2">
                          <Button size="sm" className="text-xs" onClick={recordReceipt}>Save Receipt</Button>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowReceiptForm(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {isAdmin && (
                <TabsContent value="expenses" className="mt-3">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Total Expenses</p>
                        <p className="text-xl font-bold">{currencySymbol}{totalExpenses.toFixed(2)}</p>
                      </div>

                      {expenses.map(e => (
                        <div key={e.id} className="border rounded-md p-2 text-sm space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{e.description}</span>
                            <span className="font-bold">{currencySymbol}{e.amount.toFixed(2)}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                            {e.vendor_name && <span>{e.vendor_name}</span>}
                            <Badge variant={e.is_billable ? 'default' : 'secondary'} className="text-[9px] h-4">{e.is_billable ? 'Billable' : 'Non-billable'}</Badge>
                            <span>{e.category}</span>
                          </div>
                        </div>
                      ))}

                      {!showExpenseForm && (
                        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowExpenseForm(true)}>
                          <Plus className="w-3 h-3 mr-1" /> Add Expense
                        </Button>
                      )}

                      {showExpenseForm && (
                        <div className="space-y-2 border rounded-lg p-3">
                          <div><Label className="text-xs">Vendor</Label><Input value={expVendor} onChange={e => setExpVendor(e.target.value)} placeholder="Vendor name" /></div>
                          <div><Label className="text-xs">Description *</Label><Input value={expDesc} onChange={e => setExpDesc(e.target.value)} /></div>
                          <div><Label className="text-xs">Amount</Label><Input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} /></div>
                          <div>
                            <Label className="text-xs">Category</Label>
                            <Select value={expCategory} onValueChange={setExpCategory}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="material">Material</SelectItem>
                                <SelectItem value="outsourcing">Outsourcing</SelectItem>
                                <SelectItem value="shipping">Shipping</SelectItem>
                                <SelectItem value="lab_fee">Lab Fee</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={expBillable} onChange={e => setExpBillable(e.target.checked)} className="w-3.5 h-3.5" />
                            Billable to client
                          </label>
                          <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={expNotes} onChange={e => setExpNotes(e.target.value)} /></div>
                          <div className="flex gap-2">
                            <Button size="sm" className="text-xs" onClick={addExpense}>Save</Button>
                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>

            {/* Merchant Details */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Merchant Details</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div><Label className="text-xs">Business Name</Label><Input value={merchantDetails.name} onChange={e => setMerchantDetails(p => ({ ...p, name: e.target.value }))} disabled={!isEditable} /></div>
                <div><Label className="text-xs">Address</Label><Input value={merchantDetails.address || ''} onChange={e => setMerchantDetails(p => ({ ...p, address: e.target.value }))} disabled={!isEditable} /></div>
                <div><Label className="text-xs">Bank / UPI</Label><Textarea rows={2} value={merchantDetails.bank_details || ''} onChange={e => setMerchantDetails(p => ({ ...p, bank_details: e.target.value }))} placeholder="A/C: XXXX IFSC: XXXX / UPI: xxx@upi" disabled={!isEditable} /></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
