import { StockTradesTable } from '@/components/StockTradesTable'

export default function StockTradesPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Stock Trading History</h1>
        <p className="text-muted-foreground mt-2">
          View your sold stock trades with realized profit/loss calculations
        </p>
      </div>
      
      <StockTradesTable />
    </div>
  )
} 