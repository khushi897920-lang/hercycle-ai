import { NextResponse } from 'next/server'
import { getSweepsData, registerSweep } from '@/lib/sweep-scheduler'
import { verifyRbacPermission, PERMISSIONS } from '@/lib/rbac'

export async function GET(request) {
  const authCheck = verifyRbacPermission(request, PERMISSIONS.VIEW_SWEEPS)
  if (!authCheck.authorized) {
    return NextResponse.json({ success: false, error: authCheck.reason }, { status: 403 })
  }

  try {
    const data = getSweepsData()
    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Error fetching sweeps:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch hyperparameter sweeps' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  const authCheck = verifyRbacPermission(request, PERMISSIONS.CREATE_SWEEPS)
  if (!authCheck.authorized) {
    return NextResponse.json({ success: false, error: authCheck.reason }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, modelId, modelName, sweepType, cronExpression, hyperparameterSpace, maxTrials } = body

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: modelId' },
        { status: 400 }
      )
    }

    const sweep = registerSweep({
      name,
      modelId,
      modelName,
      sweepType,
      cronExpression,
      hyperparameterSpace,
      maxTrials,
    })

    return NextResponse.json({
      success: true,
      data: sweep,
    })
  } catch (error) {
    console.error('Error creating sweep:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create scheduled hyperparameter sweep' },
      { status: 500 }
    )
  }
}
