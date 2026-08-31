import { NextResponse } from 'next/server'
import { executeSweepRun } from '@/lib/sweep-scheduler'

export async function POST(request, { params }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Sweep ID parameter required' }, { status: 400 })
    }

    const result = executeSweepRun(id)

    return NextResponse.json({
      success: true,
      message: `Sweep ${id} executed successfully.`,
      data: result,
    })
  } catch (error) {
    console.error('Error triggering sweep run:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to trigger sweep run' },
      { status: 500 }
    )
  }
}
